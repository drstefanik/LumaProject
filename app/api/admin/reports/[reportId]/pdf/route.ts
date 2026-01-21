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
  if (typeof value === "number" || typeof value === "boolean") return String(value);
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
    return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }
  const text = toText(value);
  return text ? [text] : [];
}

function buildReportDocument(report: ReportRecord) {
  const fields = report.fields;
  const section = (label: string, value: unknown) =>
    React.createElement(
      View,
      { style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, label),
      React.createElement(Text, { style: styles.sectionBody }, toText(value)),
    );
  const listSection = (label: string, value: unknown, keyPrefix: string) => {
    const items = toList(value);
    const content =
      items.length > 0
        ? items.map((item, index) =>
            React.createElement(
              Text,
              { key: `${keyPrefix}-${index}`, style: styles.bullet },
              `• ${item}`,
            ),
          )
        : [React.createElement(Text, { key: `${keyPrefix}-empty`, style: styles.sectionBody }, "—")];
    return React.createElement(
      View,
      { style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, label),
      ...content,
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
        React.createElement(Image, { style: styles.logo, src: LOGO_DATA_URI }),
        React.createElement(Text, { style: styles.title }, "LUMA Report"),
      ),
      React.createElement(
        View,
        { style: styles.metaGrid },
        React.createElement(
          View,
          { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, "Report ID"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            toText(fields.ReportID ?? report.id),
          ),
        ),
        React.createElement(
          View,
          { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, "Candidate Email"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            toText(fields.CandidateEmail),
          ),
        ),
        React.createElement(
          View,
          { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, "CEFR"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            toText(fields.CEFR_Level),
          ),
        ),
        React.createElement(
          View,
          { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, "Accent"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            toText(fields.Accent),
          ),
        ),
        React.createElement(
          View,
          { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, "Exam Date"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            toText(fields.ExamDate),
          ),
        ),
      ),
      listSection("Strengths", fields.Strengths, "strengths"),
      listSection("Weaknesses", fields.Weaknesses, "weaknesses"),
      listSection("Recommendations", fields.Recommendations, "recommendations"),
      section("Overall Comment", fields.OverallComment),
    ),
  );
}

async function generateReportPdf(report: ReportRecord) {
  const document = buildReportDocument(report);
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

    const pdfBytes = await generateReportPdf(report);
    const reportKey =
      typeof report.fields.ReportID === "string" && report.fields.ReportID.trim()
        ? report.fields.ReportID.trim()
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

    const blob = await put(filename, pdfBytes, {
      access: "public",
      contentType: "application/pdf",
    });

    const pdfGeneratedAt = new Date().toISOString();
    const updated = await updateReportByRecordId(tableName, report.id, {
      PDFUrl: blob.url,
      PDFStatus: "final",
      PDFGeneratedAt: pdfGeneratedAt,
    });

    return NextResponse.json({
      ok: true,
      pdfUrl: blob.url,
      pdfStatus: updated.fields.PDFStatus ?? "final",
      pdfGeneratedAt: updated.fields.PDFGeneratedAt ?? pdfGeneratedAt,
    });
  } catch (error) {
    const reportFields = (report as any)?.fields ?? report;
    console.error("PDF gen failed", {
      reportId,
      strengthsType: typeof reportFields?.Strengths,
      strengthsIsArray: Array.isArray(reportFields?.Strengths),
      weaknessesType: typeof reportFields?.Weaknesses,
      recType: typeof reportFields?.Recommendations,
    });
    return NextResponse.json({ ok: false, error: "Failed to generate PDF" }, { status: 500 });
  }
}
