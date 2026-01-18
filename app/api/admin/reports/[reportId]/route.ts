import { NextResponse } from "next/server";

import {
  getFirstReportByFormula,
  getReportByRecordId,
} from "@/src/lib/admin/airtable-admin";
import { getAdminFromRequest } from "@/src/lib/admin/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;
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
  if (reportId.startsWith("rec")) {
    report = await getReportByRecordId(tableName, reportId);
  } else {
    const sanitized = reportId.replace(/'/g, "\\'");
    report = await getFirstReportByFormula(tableName, `{ReportID}='${sanitized}'`);
  }

  if (!report) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, report });
}
