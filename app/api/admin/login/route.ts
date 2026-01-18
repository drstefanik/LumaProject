import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { createAudit, getAdminByEmail } from "@/src/lib/admin/airtable-admin";
import { setAdminSessionCookie } from "@/src/lib/admin/session";

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

  const adminRecord = await getAdminByEmail(email);
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

  const response = NextResponse.json({ ok: true });
  await setAdminSessionCookie(response, {
    email: fields.Email ?? email,
    role: fields.Role ?? null,
  });

  await createAudit(fields.Email ?? email, "LOGIN");

  return response;
}
