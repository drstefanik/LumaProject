import { NextResponse } from "next/server";

import {
  createAudit,
  updateReportByReportID,
} from "@/src/lib/admin/airtable-admin";
import { getAdminFromRequest } from "@/src/lib/admin/session";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;
  const session = await getAdminFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const updated = await updateReportByReportID(reportId, {
    PDFStatus: "final",
  });

  if (!updated) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  await createAudit(session.email, "PDF_FINALIZE", reportId);

  return NextResponse.json({ ok: true });
}
