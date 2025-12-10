import { NextResponse } from "next/server";

import { createRealtimeClientSecret } from "@/lib/realtimeClientSecret";

export const runtime = "edge";
export const maxDuration = 300;

export async function POST(req: Request) {
  const { OPENAI_API_KEY } = process.env;

  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  let candidateId: string | undefined;
  let candidateEmail: string | undefined;

  try {
    const body = await req.json();
    candidateId = body?.candidateId ?? undefined;
    candidateEmail = body?.candidateEmail ?? undefined;
  } catch {
    // Optional body
  }

  try {
    const clientSecret = await createRealtimeClientSecret({
      apiKey: OPENAI_API_KEY,
      metadata: {
        candidateId,
        candidateEmail,
      },
      ttlSeconds: 3600,
    });

    return NextResponse.json({ client_secret: clientSecret });
  } catch (error) {
    const message = (error as Error)?.message ?? "Unknown error";
    console.error("OpenAI client secret error:", message);
    return NextResponse.json(
      {
        error: "Failed to create client secret",
        details: message,
      },
      { status: 502 }
    );
  }
}
