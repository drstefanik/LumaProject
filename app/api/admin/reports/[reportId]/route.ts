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
  const raw = String(reportId ?? "").trim();
  const rid = decodeURIComponent(raw);

  if (!rid || rid === "undefined" || rid === "null") {
    return NextResponse.json(
      { ok: false, error: "Invalid report id" },
      { status: 400 },
    );
  }

  console.log("[admin report detail] reportId raw:", reportId, "rid:", rid);
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
    console.log(
      "[admin report detail] NOT FOUND rid:",
      rid,
      "table:",
      tableName,
    );
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, report });
}
