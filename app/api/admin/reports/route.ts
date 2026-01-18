import { NextResponse } from "next/server";

import { listReports } from "@/src/lib/admin/airtable-admin";
import {
  adminSessionCookieName,
  verifyAdminSession,
} from "@/src/lib/admin/session";

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const cefr = searchParams.get("cefr");
  const status = searchParams.get("status");
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "20");

  const result = await listReports({ q, cefr, status, page, pageSize });

  return NextResponse.json({ ok: true, ...result });
}
