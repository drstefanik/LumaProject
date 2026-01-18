import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/src/lib/admin/session";

export async function POST(request: Request) {
  const session = await getAdminFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: false,
    error: "PDF generation not implemented yet",
  });
}
