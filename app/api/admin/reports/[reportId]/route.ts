import { NextResponse } from "next/server";

import {
  getFirstReportByFormula,
  getReportByRecordId,
} from "@/src/lib/admin/airtable-admin";
import { normalizeReportId } from "@/src/lib/admin/report-id";
import { getAdminFromRequest } from "@/src/lib/admin/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;
  const decoded = normalizeReportId(reportId);
  const normalized = decoded.trim();
  const isReportCode = normalized.startsWith("REP-");

  const session = await getAdminFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const tableName =
    process.env.LUMA_REPORTS_TABLE || process.env.AIRTABLE_TABLE_REPORTS;

  if (!tableName) {
    throw new Error("LUMA_REPORTS_TABLE is missing.");
  }

  let report = null;
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
    console.log(
      "[admin report detail] NOT FOUND rid:",
      normalized,
      "table:",
      tableName,
    );
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, report });
}
