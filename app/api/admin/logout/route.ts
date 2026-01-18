import { NextResponse } from "next/server";

import {
  adminSessionCookieName,
  getAdminSessionCookieOptions,
} from "@/src/lib/admin/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminSessionCookieName, "", {
    ...getAdminSessionCookieOptions(),
    maxAge: 0,
  });

  return response;
}
