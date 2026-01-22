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

/**
 * Minimal Airtable AdminUsers lookup to make signup idempotent.
 * This avoids “errore ma account creato” when:
 * - the client double-submits
 * - OTP is already marked used after a successful first request
 */
async function getExistingAdminByEmail(email: string): Promise<{
  exists: boolean;
  recordId?: string;
  fields?: Record<string, unknown>;
}> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  // Prefer explicit env, fallback to literal table name if your base uses it.
  const tableName = process.env.AIRTABLE_TABLE_ADMIN_USERS || "AdminUsers";

  if (!apiKey || !baseId) {
    // If env is not available (misconfig), we just skip idempotency lookup.
    return { exists: false };
  }

  const AIRTABLE_API_URL = "https://api.airtable.com/v0";
  const tableUrl = `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(
    tableName,
  )}`;

  const escapeFormulaValue = (v: string) => v.replace(/"/g, '\\"');

  const params = new URLSearchParams();
  params.set("maxRecords", "1");
  params.set("filterByFormula", `{Email} = "${escapeFormulaValue(email)}"`);
  params.append("fields[]", "Email");
  params.append("fields[]", "Role");
  params.append("fields[]", "IsActive");
  params.append("fields[]", "FullName");

  const res = await fetch(`${tableUrl}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    // Don’t hard-fail signup because of a lookup problem.
    return { exists: false };
  }

  const data = (await res.json()) as {
    records?: Array<{ id: string; fields: Record<string, unknown> }>;
  };

  const record = data.records?.[0];
  if (!record) return { exists: false };

  return { exists: true, recordId: record.id, fields: record.fields };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const otp = typeof body?.otp === "string" ? body.otp.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";

  // ✅ Payload errors must not masquerade as OTP errors
  if (!email || !otp || !password || !fullName) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 },
    );
  }

  // ✅ Idempotency: if admin already exists, succeed (prevents double-submit confusion)
  const preExisting = await getExistingAdminByEmail(email);
  if (preExisting.exists) {
    return NextResponse.json({ ok: true, alreadyExists: true });
  }

  const invite = await getLatestValidInviteByEmail(email);

  // If invite is missing, it *might* be because a parallel request already consumed it.
  // If the admin now exists, treat as success.
  if (!invite) {
    const nowExisting = await getExistingAdminByEmail(email);
    if (nowExisting.exists) {
      return NextResponse.json({ ok: true, alreadyExists: true });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid or expired OTP" },
      { status: 401 },
    );
  }

  const otpHash = await hashOtp(otp);
  const inviteHash = invite.fields.OTPHash ?? "";
  const isUsed = Boolean(invite.fields.IsUsed ?? false);

  // OTP mismatch / already used
  if (inviteHash !== otpHash || isUsed) {
    // ✅ If admin exists already (double submit / race), return success
    const nowExisting = await getExistingAdminByEmail(email);
    if (nowExisting.exists) {
      return NextResponse.json({ ok: true, alreadyExists: true });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid or expired OTP" },
      { status: 401 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const createResult = await createAdmin({
    email,
    passwordHash,
    role: invite.fields.Role ?? null,
    fullName,
    isActive: true,
  });

  if (!createResult.ok) {
    // ✅ If create failed due to race but user exists, still succeed
    const nowExisting = await getExistingAdminByEmail(email);
    if (nowExisting.exists) {
      return NextResponse.json({ ok: true, alreadyExists: true });
    }

    return NextResponse.json(
      { ok: false, error: createResult.error },
      { status: 500 },
    );
  }

  // ✅ Side-effects must never make the signup look failed after user creation
  try {
    await markInviteUsed(invite.id);
  } catch (e) {
    console.error("[admin-signup] markInviteUsed failed", e);
  }

  try {
    await createAudit(email, "ADMIN_CREATED");
  } catch (e) {
    console.error("[admin-signup] createAudit failed", e);
  }

  return NextResponse.json({ ok: true });
}
