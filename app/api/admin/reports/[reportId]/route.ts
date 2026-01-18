import { NextResponse } from "next/server";

import { getReportByReportID } from "@/src/lib/admin/airtable-admin";
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

  const report = await getReportByReportID(reportId);
  if (!report) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, report });
}
