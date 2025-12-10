import { NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 300;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    // Check env vars
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    // Read metadata (optional)
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const { candidateId, candidateEmail } = body;

    // ✅ CREA IL CLIENT SECRET (NUOVA API CORRETTA)
    // Nessun "model", nessun "session", nessun "modalities".
    const secret = await openai.client.secrets.create({
      ttl: 3600, // 1 ora
      metadata: {
        candidateId: candidateId ?? null,
        candidateEmail: candidateEmail ?? null,
      },
    });

    return NextResponse.json({
      client_secret: secret.secret,
    });
  } catch (error: any) {
    console.error("Error creating client secret:", error);
    return NextResponse.json(
      { error: "Failed to create client secret", details: error },
      { status: 500 }
    );
  }
}
