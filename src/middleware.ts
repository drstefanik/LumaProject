import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  adminSessionCookieName,
  verifyAdminSession,
} from "@/src/lib/admin/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (pathname === "/admin/login" || pathname === "/admin/signup") {
    return NextResponse.next();
  }

  const token = request.cookies.get(adminSessionCookieName)?.value;
  const session = await verifyAdminSession(token);

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
