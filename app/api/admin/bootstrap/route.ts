import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import {
  countAdmins,
  createAdmin,
  createAudit,
} from "@/src/lib/admin/airtable-admin";

function generatePassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let password = "";
  for (let i = 0; i < 16; i += 1) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function POST(request: Request) {
  const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
  if (!bootstrapSecret) {
    return NextResponse.json(
      { ok: false, error: "Bootstrap disabled" },
      { status: 403 },
    );
  }

  const existingCount = await countAdmins();
  if (existingCount > 0) {
    return NextResponse.json(
      { ok: false, error: "Bootstrap disabled" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const secret = typeof body?.secret === "string" ? body.secret : "";
  if (!secret || secret !== bootstrapSecret) {
    return NextResponse.json(
      { ok: false, error: "Invalid secret" },
      { status: 401 },
    );
  }

  const email =
    typeof body?.email === "string" && body.email.trim()
      ? body.email.trim()
      : "admin@lumahub.org";
  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);

  await createAdmin({
    email,
    passwordHash,
    role: "admin",
    fullName: "System Bootstrap",
    isActive: true,
  });

  await createAudit(email, "BOOTSTRAP_ADMIN_CREATED");

  return NextResponse.json({
    ok: true,
    email,
    password,
    message: "Remove ADMIN_BOOTSTRAP_SECRET from Vercel to disable bootstrap.",
  });
}
