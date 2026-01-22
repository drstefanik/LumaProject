import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { AbortController } from "node-abort-controller";
import fs from "node:fs/promises";
import path from "node:path";

import {
  getFirstReportByFormula,
  getReportByRecordId,
  updateReportByRecordId,
} from "@/src/lib/admin/airtable-admin";
import { normalizeReportId } from "@/src/lib/admin/report-id";
import { getAdminFromRequest } from "@/src/lib/admin/session";

export const dynamic = "force-dynamic";

const WORKER_TIMEOUT_MS = 25_000;

type ReportRecord = { id: string; fields: Record<string, unknown> };

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="16" fill="#0f172a" />
  <text x="50%" y="54%" text-anchor="middle" font-size="32" fill="#ffffff" font-family="Helvetica">L</text>
</svg>`;
const LOGO_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(LOGO_SVG)}`;

async function loadPublicImageDataUri(relPath: string) {
  const abs = path.join(process.cwd(), "public", relPath);
  const buf = await fs.readFile(abs);
  const b64 = buf.toString("base64");
  const ext = relPath.split(".").pop()?.toLowerCase();
  const mime =
    ext === "png"
      ? "image/png"
      : ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : "application/octet-stream";
  return `data:${mime};base64,${b64}`;
}

function getBaseUrlFromRequest(request: NextRequest) {
  // Vercel/Proxies can send multiple values "https,http" -> take first
  const protoRaw = request.headers.get("x-forwarded-proto") ?? "https";
  const forwardedProto = protoRaw.split(",")[0]?.trim() || "https";

  const hostRaw =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "lumahub.org";
  const forwardedHost = hostRaw.split(",")[0]?.trim() || "lumahub.org";

  return `${forwardedProto}://${forwardedHost}`;
}

function withTimeout(ms: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(t) };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reportId: string }> },
) {
  const session = await getAdminFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { reportId } = await context.params;
  let report: ReportRecord | null = null;

  try {
    const decoded = normalizeReportId(reportId);
    const normalized = decoded.trim();
    const isReportCode = normalized.startsWith("REP-");

    const tableName =
      process.env.LUMA_REPORTS_TABLE || process.env.AIRTABLE_TABLE_REPORTS;

    if (!tableName) {
      throw new Error("LUMA_REPORTS_TABLE is missing.");
    }

    if (isReportCode) {
      const sanitized = normalized.replace(/"/g, "\\\"");
      report = await getFirstReportByFormula(
        tableName,
        `{ReportID} = "${sanitized}"`,
      );
    } else {
      report = await getReportByRecordId(tableName, normalized);
    }

    if (!report) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const logoSrc =
      (process.env.LUMA_PDF_LOGO_URL || "").trim() ||
      (await loadPublicImageDataUri("luma-logo.png").catch(() => LOGO_DATA_URI));

    const baseUrl = getBaseUrlFromRequest(request);
    const workerUrl = `${baseUrl}/api/pdf-worker`;

    const { controller, clear } = withTimeout(WORKER_TIMEOUT_MS);
    const workerRes = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        reportId,
        logoSrc,
        report: {
          id: report.id,
          createdTime: (report as any).createdTime,
          fields: report.fields,
        },
      }),
    });
    clear();

    if (!workerRes.ok) {
      const txt = await workerRes.text();
      throw new Error(`[pdf] worker failed: ${workerRes.status} ${txt}`);
    }

    const pdfArrayBuffer = await workerRes.arrayBuffer();
    const pdfBytes = Buffer.from(pdfArrayBuffer);

    const reportKey =
      typeof (report.fields as any).ReportID === "string" &&
      (report.fields as any).ReportID.trim()
        ? (report.fields as any).ReportID.trim()
        : report.id;

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return new NextResponse(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="report-${reportKey}.pdf"`,
        },
      });
    }

    const filename = `reports/${reportKey}.pdf`;
    let blobUrl: string | null = null;

    try {
      const blob = await put(filename, pdfBytes, {
        access: "public",
        contentType: "application/pdf",
      });
      blobUrl = blob.url;
    } catch (blobError) {
      console.error("[pdf] blob upload failed", {
        reportId,
        message: (blobError as any)?.message,
        name: (blobError as any)?.name,
        stack: (blobError as any)?.stack,
      });

      return new NextResponse(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="report-${reportKey}.pdf"`,
        },
      });
    }

    const pdfGeneratedAt = new Date().toISOString();
    let updated: ReportRecord | null = null;

    try {
      updated = await updateReportByRecordId(tableName, report.id, {
        PDFUrl: blobUrl,
        PDFStatus: "final",
        PDFGeneratedAt: pdfGeneratedAt,
      });
    } catch (airtableError) {
      console.error("[pdf] airtable update failed", {
        reportId,
        message: (airtableError as any)?.message,
        name: (airtableError as any)?.name,
        stack: (airtableError as any)?.stack,
      });
    }

    return NextResponse.json({
      ok: true,
      pdfUrl: blobUrl,
      pdfStatus: (updated?.fields as any)?.PDFStatus ?? "final",
      pdfGeneratedAt: (updated?.fields as any)?.PDFGeneratedAt ?? pdfGeneratedAt,
    });
  } catch (err: any) {
    console.error("[pdf] FAILED", {
      reportId,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
      cause: err?.cause,
    });
    return NextResponse.json(
      { ok: false, error: err?.message || "PDF generation failed" },
      { status: 500 },
    );
  }
}

// Avoid accidental GET/HEAD prefetch noise from Next/Chrome.
export async function HEAD() {
  return new NextResponse(null, { status: 204 });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Method not allowed" },
    { status: 405 },
  );
}
