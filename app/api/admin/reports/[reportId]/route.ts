import { NextResponse } from "next/server";

import { getFirstReportByFormula } from "@/src/lib/admin/airtable-admin";
import { normalizeReportId } from "@/src/lib/admin/report-id";
import { getAdminFromRequest } from "@/src/lib/admin/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;
  const decoded = normalizeReportId(reportId);
  const normalized = decoded.trim();
  const isRecordId = normalized.startsWith("rec");
  const isReportCode = normalized.startsWith("REP-");
  const idType = isRecordId ? "rec" : isReportCode ? "REP-" : "other";
  const reportIdField = "{ReportID}";

  const session = await getAdminFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const tableName = process.env.LUMA_REPORTS_TABLE;

  if (!tableName) {
    throw new Error("LUMA_REPORTS_TABLE is missing.");
  }

  const logLookup = (details: {
    lookup: number;
    method: "get-by-id" | "filterByFormula";
    foundCount: number;
    formula?: string | null;
  }) => {
    console.log("[admin report detail] lookup", {
      baseId: process.env.AIRTABLE_BASE_ID ?? null,
      tableName,
      idRequested: normalized,
      idType,
      lookup: details.lookup,
      method: details.method,
      foundCount: details.foundCount,
      formula: details.formula ?? null,
      field: details.formula ? reportIdField : null,
    });
  };

  let report = null;
  if (isRecordId || isReportCode) {
    const reportCode = isRecordId ? `REP-${normalized}` : normalized;
    const sanitized = reportCode.replace(/"/g, "\\\"");
    const formula = `${reportIdField} = "${sanitized}"`;
    report = await getFirstReportByFormula(tableName, formula);
    logLookup({
      lookup: 1,
      method: "filterByFormula",
      foundCount: report ? 1 : 0,
      formula,
    });
  } else {
    return NextResponse.json(
      { ok: false, error: "Invalid report id" },
      { status: 400 },
    );
  }

  if (!report) {
    console.log(
      "[admin report detail] NOT FOUND rid:",
      normalized,
      "table:",
      tableName,
      "note: id may be wrong or LUMA_REPORTS_TABLE points to the wrong table/base",
    );
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, report });
}
