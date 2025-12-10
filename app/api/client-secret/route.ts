import { NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 300;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  project: process.env.OPENAI_PROJECT_ID,
});


export async function POST(req: Request) {
  try {
    const missing: Record<string, boolean> = {
      OPENAI_API_KEY: !process.env.OPENAI_API_KEY,
      OPENAI_PROJECT_ID: !process.env.OPENAI_PROJECT_ID,
      OPENAI_REALTIME_MODEL: !process.env.OPENAI_REALTIME_MODEL,
    };

    const missingKeys = Object.entries(missing)
      .filter(([, isMissing]) => isMissing)
      .map(([key]) => key);

    if (missingKeys.length > 0) {
      console.error("Missing OpenAI env vars:", missingKeys);
      return NextResponse.json(
        {
          error: "Missing required OpenAI configuration.",
          missing,
        },
        { status: 500 }
      );
    }

    // Optional: read candidate metadata (if the client sends it)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { candidateId, candidateEmail } = body;

    const clientSecret = await openai.clientSecrets.create({
      project: process.env.OPENAI_PROJECT_ID!,
      display_name: "LUMA Realtime Session",
      expires_after: {
        anchor: "now",
        duration: "1h",
      },
      session: {
        type: "realtime",
        model: process.env.OPENAI_REALTIME_MODEL!,
        modalities: ["audio", "text"],
        input_audio_transcription: { enabled: true },
        // metadata opzionale, utile per tracciare chi è in sessione
        metadata: {
          candidateId: candidateId ?? undefined,
          candidateEmail: candidateEmail ?? undefined,
        },
      },
    });

    return NextResponse.json({ client_secret: clientSecret.secret });
  } catch (error) {
    console.error("Internal error creating client secret:", error);
    return NextResponse.json(
      { error: "Failed to create client secret" },
      { status: 500 }
    );
  }
}
