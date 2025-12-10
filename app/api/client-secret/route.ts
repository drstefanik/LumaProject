import { NextResponse } from "next/server";

export const maxDuration = 300;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_PROJECT_ID = process.env.OPENAI_PROJECT_ID;
const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL;

export async function POST(req: Request) {
  try {
    // Controllo variabili d'ambiente
    const missing: Record<string, boolean> = {
      OPENAI_API_KEY: !OPENAI_API_KEY,
      OPENAI_PROJECT_ID: !OPENAI_PROJECT_ID,
      OPENAI_REALTIME_MODEL: !OPENAI_REALTIME_MODEL,
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

    // Leggo eventuali metadata dal body
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { candidateId, candidateEmail } = body ?? {};

    // Chiamata diretta all'endpoint REST per creare il client secret
    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          // opzionale ma utile se usi i Projects
          ...(OPENAI_PROJECT_ID
            ? { "OpenAI-Project": OPENAI_PROJECT_ID }
            : {}),
        },
        body: JSON.stringify({
          expires_after: {
            anchor: "created_at",
            seconds: 3600, // 1 ora
          },
          session: {
            type: "realtime",
            model: OPENAI_REALTIME_MODEL,
            modalities: ["audio", "text"],
            input_audio_transcription: { enabled: true },
            metadata: {
              candidateId: candidateId ?? null,
              candidateEmail: candidateEmail ?? null,
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(
        "Error from OpenAI when creating client secret:",
        errText
      );
      return NextResponse.json(
        {
          error: "Failed to create client secret",
          details: errText,
        },
        { status: 500 }
      );
    }

    // La risposta ha la forma { value: "ek_...", expires_at: ..., session: {...} }
    const clientSecret = (await response.json()) as {
      value: string;
      expires_at: number;
      session: unknown;
    };

    return NextResponse.json({ client_secret: clientSecret.value });
  } catch (error) {
    console.error("Internal error creating client secret:", error);
    return NextResponse.json(
      { error: "Failed to create client secret" },
      { status: 500 }
    );
  }
}
