import { put } from "@vercel/blob";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";

import {
  getFirstReportByFormula,
  getReportByRecordId,
  updateReportByRecordId,
} from "@/src/lib/admin/airtable-admin";
import { getAdminFromRequest } from "@/src/lib/admin/session";

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
  return String(value);
}

function buildPdfLines(report: { id: string; fields: Record<string, unknown> }) {
  const lines = [
    "Luma Report",
    "",
    `Record ID: ${report.id}`,
    `Report ID: ${formatFieldValue(report.fields.ReportID)}`,
    `Candidate: ${formatFieldValue(report.fields.CandidateEmail)}`,
    `CEFR Level: ${formatFieldValue(report.fields.CEFR_Level)}`,
    `Accent: ${formatFieldValue(report.fields.Accent)}`,
    `Exam Date: ${formatFieldValue(report.fields.ExamDate)}`,
    "",
    "Report Fields:",
    "",
  ];

  Object.entries(report.fields).forEach(([key, value]) => {
    lines.push(`${key}: ${formatFieldValue(value)}`);
  });

  return lines;
}

async function generateReportPdf(report: {
  id: string;
  fields: Record<string, unknown>;
}) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();
  const fontSize = 12;
  const lineHeight = 16;
  const margin = 48;

  const lines = buildPdfLines(report);
  let y = height - margin;

  lines.forEach((line, index) => {
    if (y < margin) {
      y = height - margin;
      pdfDoc.addPage([612, 792]);
    }
    const targetPage = pdfDoc.getPage(pdfDoc.getPageCount() - 1);
    targetPage.drawText(line, {
      x: margin,
      y,
      size: index === 0 ? 18 : fontSize,
      font,
      color: rgb(0.12, 0.12, 0.12),
    });
    y -= lineHeight;
  });

  return Buffer.from(await pdfDoc.save());
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
  const raw = String(reportId ?? "").trim();
  const rid = decodeURIComponent(raw);

  if (!rid || rid === "undefined" || rid === "null") {
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
  if (rid.startsWith("rec")) {
    report = await getReportByRecordId(tableName, rid);
  } else {
    const sanitized = rid.replace(/"/g, "\\\"");
    report = await getFirstReportByFormula(
      tableName,
      `{ReportID} = "${sanitized}"`,
    );
  }

  if (!report) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "Storage not configured for PDF generation." },
      { status: 500 },
    );
  }

  const pdfBytes = await generateReportPdf(report);
  const reportKey =
    typeof report.fields.ReportID === "string" && report.fields.ReportID.trim()
      ? report.fields.ReportID.trim()
      : report.id;
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
