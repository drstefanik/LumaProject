import { NextResponse } from "next/server";

import { createAudit } from "@/src/lib/admin/airtable-admin";
import {
  createOtpInvite,
  invalidatePreviousInvites,
} from "@/src/lib/admin/airtable-otps";
import { getAdminFromRequest } from "@/src/lib/admin/session";

function generateOtp() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let otp = "";
  for (let i = 0; i < 8; i += 1) {
    otp += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return otp;
}

function hashOtp(otp: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is missing.");
  }
  const data = new TextEncoder().encode(`${otp}${secret}`);
  return crypto.subtle.digest("SHA-256", data).then((hash) => {
    const bytes = new Uint8Array(hash);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  });
}

export async function POST(request: Request) {
  const session = await getAdminFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const role = typeof body?.role === "string" ? body.role.trim() : "";

  if (!email) {
    return NextResponse.json(
      { ok: false, error: "Email is required" },
      { status: 400 },
    );
  }

  await invalidatePreviousInvites(email);

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await createOtpInvite({
    email,
    otpHash,
    expiresAt,
    role: role || null,
    createdBy: session.email,
  });

  try {
    await createAudit(session.email, "INVITE_CREATE");
  } catch (error) {
    console.error("audit log failed", error);
  }

  return NextResponse.json({ ok: true, otp, expiresAt });
}
