import { NextResponse } from "next/server";

import {
  createAuditLog,
  updateReportByReportId,
} from "@/src/lib/admin/airtable-admin";
import {
  adminSessionCookieName,
  verifyAdminSession,
} from "@/src/lib/admin/session";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const tokenMatch = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${adminSessionCookieName}=`));
  const token = tokenMatch?.split("=")[1];

  const session = await verifyAdminSession(token);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const updated = await updateReportByReportId(reportId, {
    PDFStatus: "final",
  });

  if (!updated) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  await createAuditLog(session.email, "PDF_FINALIZE", reportId);

  return NextResponse.json({ ok: true });
}
