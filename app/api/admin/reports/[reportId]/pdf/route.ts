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

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (item == null ? [] : [String(item)]))
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
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  const text = toText(value);
  return text ? [text] : [];
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
  const fields = report.fields as any;

  const toLines = (v: unknown) => {
    const items = toList(v);
    if (items.length === 0) return ["—"];
    return items;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {/* Se Image dà problemi, commenta questa riga per test */}
          <Image style={styles.logo} src={logoSrc} />
          <Text style={styles.title}>LUMA Report</Text>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Report ID</Text>
            <Text style={styles.metaValue}>
              {toText(fields.ReportID ?? report.id)}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Candidate Email</Text>
            <Text style={styles.metaValue}>{toText(fields.CandidateEmail)}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>CEFR</Text>
            <Text style={styles.metaValue}>{toText(fields.CEFR_Level)}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Accent</Text>
            <Text style={styles.metaValue}>{toText(fields.Accent)}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Exam Date</Text>
            <Text style={styles.metaValue}>{toText(fields.ExamDate)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Strengths</Text>
          {toLines(fields.Strengths).map((line, i) => (
            <Text key={`strengths-${i}`} style={styles.bullet}>
              • {line}
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weaknesses</Text>
          {toLines(fields.Weaknesses).map((line, i) => (
            <Text key={`weaknesses-${i}`} style={styles.bullet}>
              • {line}
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          {toLines(fields.Recommendations).map((line, i) => (
            <Text key={`recommendations-${i}`} style={styles.bullet}>
              • {line}
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overall Comment</Text>
          <Text style={styles.sectionBody}>
            {toText(fields.OverallComment) || "—"}
          </Text>
        </View>
      </Page>
    </Document>
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
