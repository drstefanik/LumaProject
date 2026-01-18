import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { createAdmin, createAudit } from "@/src/lib/admin/airtable-admin";
import {
  getLatestValidInviteByEmail,
  markInviteUsed,
} from "@/src/lib/admin/airtable-otps";

async function hashOtp(otp: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is missing.");
  }
  const data = new TextEncoder().encode(`${otp}${secret}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const otp = typeof body?.otp === "string" ? body.otp.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";

  if (!email || !otp || !password || !fullName) {
    return NextResponse.json(
      { ok: false, error: "Invalid or expired OTP" },
      { status: 400 },
    );
  }

  const invite = await getLatestValidInviteByEmail(email);
  if (!invite) {
    return NextResponse.json(
      { ok: false, error: "Invalid or expired OTP" },
      { status: 401 },
    );
  }

  const otpHash = await hashOtp(otp);
  if (invite.fields.OTPHash !== otpHash || invite.fields.IsUsed) {
    return NextResponse.json(
      { ok: false, error: "Invalid or expired OTP" },
      { status: 401 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await createAdmin({
    email,
    passwordHash,
    role: invite.fields.Role ?? null,
    fullName,
    isActive: true,
  });

  await markInviteUsed(invite.id);
  await createAudit(email, "ADMIN_CREATED");

  return NextResponse.json({ ok: true });
}
