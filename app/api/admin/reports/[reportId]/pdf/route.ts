import { put } from "@vercel/blob";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

import {
  getFirstReportByFormula,
  getReportByRecordId,
  updateReportByRecordId,
} from "@/src/lib/admin/airtable-admin";
import { normalizeReportId } from "@/src/lib/admin/report-id";
import { getAdminFromRequest } from "@/src/lib/admin/session";

type ReportRecord = { id: string; fields: Record<string, unknown> };

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="16" fill="#0f172a" />
  <text x="50%" y="54%" text-anchor="middle" font-size="32" fill="#ffffff" font-family="Helvetica">L</text>
</svg>`;
const LOGO_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(LOGO_SVG)}`;

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 12,
    color: "#0f172a",
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    width: 36,
    height: 36,
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  metaGrid: {
    marginBottom: 18,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    color: "#475569",
  },
  metaValue: {
    fontSize: 12,
    color: "#0f172a",
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    color: "#475569",
    marginBottom: 4,
  },
  sectionBody: {
    fontSize: 12,
    color: "#0f172a",
  },
  bullet: {
    fontSize: 12,
    color: "#0f172a",
    marginLeft: 8,
    marginBottom: 2,
  },
});

function toText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (React.isValidElement<{ children?: React.ReactNode }>(value)) {
    return toText(value.props?.children);
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (item == null ? [] : [toText(item)]))
      .filter(Boolean)
      .join("\n");
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toList(value: unknown): string[] {
  if (value == null) return [];
  if (React.isValidElement<{ children?: React.ReactNode }>(value)) {
    return toList(value.props?.children);
  }
  if (Array.isArray(value)) return value.map((item) => toText(item)).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  const text = toText(value);
  return text ? [text] : [];
}

function toListText(value: unknown): string {
  const items = toList(value);
  if (items.length === 0) return "—";
  return items.map((item) => `• ${item}`).join("\n");
}

function normalizeFieldValue(value: unknown): unknown {
  if (React.isValidElement<{ children?: React.ReactNode }>(value)) {
    return normalizeFieldValue(value.props?.children);
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeFieldValue(item));
  }
  if (value && typeof value === "object") {
    const normalized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      normalized[key] = normalizeFieldValue(item);
    }
    return normalized;
  }
  return value;
}

function normalizeFields(fields: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    normalized[key] = normalizeFieldValue(value);
  }
  return normalized;
}

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

function buildReportDocument(report: ReportRecord, logoSrc: string) {
  const fields = normalizeFields(report.fields);

  const metaRow = (label: string, value: unknown, keyPrefix: string) =>
    React.createElement(
      View,
      { key: keyPrefix, style: styles.metaRow },
      React.createElement(Text, { style: styles.metaLabel }, label),
      React.createElement(Text, { style: styles.metaValue }, toText(value) || "—"),
    );

  const section = (label: string, value: unknown, keyPrefix: string) =>
    React.createElement(
      View,
      { key: keyPrefix, style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, label),
      React.createElement(Text, { style: styles.sectionBody }, toText(value) || "—"),
    );

  const listSection = (label: string, value: unknown, keyPrefix: string) => {
    return React.createElement(
      View,
      { key: keyPrefix, style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, label),
      React.createElement(
        Text,
        { style: styles.sectionBody },
        toListText(value),
      ),
    );
  };

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Image, { style: styles.logo, src: logoSrc }),
        React.createElement(Text, { style: styles.title }, "LUMA Report"),
      ),
      React.createElement(
        View,
        { style: styles.metaGrid },
        metaRow("Report ID", (fields as any).ReportID ?? report.id, "meta-reportid"),
        metaRow("Candidate Email", (fields as any).CandidateEmail, "meta-email"),
        metaRow("CEFR", (fields as any).CEFR_Level, "meta-cefr"),
        metaRow("Accent", (fields as any).Accent, "meta-accent"),
        metaRow("Exam Date", (fields as any).ExamDate, "meta-examdate"),
      ),
      listSection("Strengths", (fields as any).Strengths, "strengths"),
      listSection("Weaknesses", (fields as any).Weaknesses, "weaknesses"),
      listSection("Recommendations", (fields as any).Recommendations, "recommendations"),
      section("Overall Comment", (fields as any).OverallComment, "overall"),
    ),
  );
}

async function generateReportPdf(report: ReportRecord, logoSrc: string) {
  const document = buildReportDocument(report, logoSrc);
  const pdfBuffer = await renderToBuffer(document);
  return Buffer.from(pdfBuffer);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const session = await getAdminFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { reportId } = await params;
  let report: ReportRecord | null = null;

  try {
    console.log("[pdf] start", { reportId });

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

    console.log("[pdf] fetched report");

    if (!report) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const logoSrc =
      (process.env.LUMA_PDF_LOGO_URL || "").trim() ||
      (await loadPublicImageDataUri("luma-logo.png").catch(() => LOGO_DATA_URI));

    console.log("[pdf] building doc");
    console.log("[pdf] renderToBuffer start");

    const pdfBytes = await generateReportPdf(report, logoSrc);

    console.log("[pdf] renderToBuffer ok", { bytes: pdfBytes?.length });

    const reportKey =
      typeof (report.fields as any).ReportID === "string" &&
      (report.fields as any).ReportID.trim()
        ? (report.fields as any).ReportID.trim()
        : report.id;

    // If blob not configured, return inline PDF
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
      console.log("[pdf] blob upload start");
      const blob = await put(filename, pdfBytes, {
        access: "public",
        contentType: "application/pdf",
      });
      blobUrl = blob.url;
      console.log("[pdf] blob upload ok", { url: blob.url });
    } catch (blobError) {
      console.error("[pdf] blob upload failed", {
        reportId,
        message: (blobError as any)?.message,
        name: (blobError as any)?.name,
        stack: (blobError as any)?.stack,
      });

      // fallback: still return inline PDF
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
      console.log("[pdf] airtable update start");
      updated = await updateReportByRecordId(tableName, report.id, {
        PDFUrl: blobUrl,
        PDFStatus: "final",
        PDFGeneratedAt: pdfGeneratedAt,
      });
      console.log("[pdf] airtable update ok");
    } catch (airtableError) {
      console.error("[pdf] airtable update failed", {
        reportId,
        message: (airtableError as any)?.message,
        name: (airtableError as any)?.name,
        stack: (airtableError as any)?.stack,
      });
      // continue; return blob url anyway
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
