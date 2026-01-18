import { NextResponse } from "next/server";

import { listReports } from "@/src/lib/admin/airtable-admin";
import { getAdminFromRequest } from "@/src/lib/admin/session";

export async function GET(request: Request) {
  const session = await getAdminFromRequest(request);
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
