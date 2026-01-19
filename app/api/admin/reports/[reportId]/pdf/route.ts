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
import { classifyReportId, normalizeReportId } from "@/src/lib/admin/report-id";
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
});

function formatFieldValue(value: unknown) {
  if (value === null || value === undefined) {
    return "—";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  const stringValue = String(value).trim();
  return stringValue.length > 0 ? stringValue : "—";
}

function buildReportDocument(report: ReportRecord) {
  const fields = report.fields;
  const section = (label: string, value: unknown) =>
    React.createElement(
      View,
      { style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, label),
      React.createElement(Text, { style: styles.sectionBody }, formatFieldValue(value)),
    );

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
            formatFieldValue(fields.ReportID ?? report.id),
          ),
        ),
        React.createElement(
          View,
          { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, "Candidate Email"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            formatFieldValue(fields.CandidateEmail),
          ),
        ),
        React.createElement(
          View,
          { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, "CEFR"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            formatFieldValue(fields.CEFR_Level),
          ),
        ),
        React.createElement(
          View,
          { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, "Accent"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            formatFieldValue(fields.Accent),
          ),
        ),
        React.createElement(
          View,
          { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, "Exam Date"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            formatFieldValue(fields.ExamDate),
          ),
        ),
      ),
      section("Strengths", fields.Strengths),
      section("Weaknesses", fields.Weaknesses),
      section("Recommendations", fields.Recommendations),
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
  const raw = normalizeReportId(reportId);
  const decoded = decodeURIComponent(raw);
  const { kind, normalized } = classifyReportId(decoded);

  if (kind === "invalid") {
    return NextResponse.json(
      { ok: false, error: "Invalid report id" },
      { status: 400 },
    );
  }

  const tableName =
    process.env.LUMA_REPORTS_TABLE || process.env.AIRTABLE_TABLE_REPORTS;

  if (!tableName) {
    throw new Error("LUMA_REPORTS_TABLE is missing.");
  }

  let report = null;
  if (kind === "airtableRecordId") {
    report = await getReportByRecordId(tableName, normalized);
  } else if (kind === "reportId") {
    const sanitized = normalized.replace(/"/g, "\\\"");
    report = await getFirstReportByFormula(
      tableName,
      `{ReportID} = "${sanitized}"`,
    );
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
}
