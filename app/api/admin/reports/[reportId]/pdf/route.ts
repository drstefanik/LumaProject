import { NextResponse } from "next/server";

import {
  adminSessionCookieName,
  verifyAdminSession,
} from "@/src/lib/admin/session";

export async function POST(request: Request) {
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

  return NextResponse.json({
    ok: false,
    error: "PDF generation not implemented yet",
  });
}
