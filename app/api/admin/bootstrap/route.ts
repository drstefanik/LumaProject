import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  createAudit,
  countAdmins,
  createAdmin,
} from "@/src/lib/admin/airtable-admin";

export const runtime = "nodejs"; // important for bcrypt/crypto on Vercel

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Method not allowed. Use POST." },
    { status: 405 },
  );
}

export async function POST(req: Request) {
  try {
    const secretEnv = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (!secretEnv) {
      // hide existence if disabled
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const secret = String(body.secret || "");
    const email = String(body.email || "admin@lumahub.org");

    if (!secret || secret !== secretEnv) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const existing = await countAdmins();
    if (existing > 0) {
      return NextResponse.json({ ok: false, error: "Bootstrap disabled" }, { status: 403 });
    }

    // generate strong password once
    const password = crypto.randomBytes(12).toString("base64url"); // ~16 chars
    const passwordHash = await bcrypt.hash(password, 12);

    await createAdmin({
      email,
      passwordHash,
      role: "admin",
      isActive: true,
      fullName: "System Bootstrap",
    });

    await createAudit(email, "BOOTSTRAP_ADMIN_CREATED");

    return NextResponse.json({ ok: true, email, password });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
