import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import {
  createAuditLog,
  getAdminUserByEmail,
} from "@/src/lib/admin/airtable-admin";
import {
  adminSessionCookieName,
  getAdminSessionCookieOptions,
  signAdminSession,
} from "@/src/lib/admin/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Invalid credentials" },
      { status: 400 },
    );
  }

  const adminRecord = await getAdminUserByEmail(email);
  const fields = adminRecord?.fields;

  if (!fields?.IsActive || !fields?.PasswordHash) {
    return NextResponse.json(
      { ok: false, error: "Invalid credentials" },
      { status: 401 },
    );
  }

  const isValid = await bcrypt.compare(password, fields.PasswordHash);

  if (!isValid) {
    return NextResponse.json(
      { ok: false, error: "Invalid credentials" },
      { status: 401 },
    );
  }

  const token = await signAdminSession({
    email: fields.Email ?? email,
    role: fields.Role ?? null,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    adminSessionCookieName,
    token,
    getAdminSessionCookieOptions(),
  );

  await createAuditLog(fields.Email ?? email, "LOGIN");

  return response;
}
