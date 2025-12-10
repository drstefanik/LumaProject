import { NextResponse } from "next/server";

export const maxDuration = 300;

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

    // Leggo eventuali metadati passati dal client (candidateId, candidateEmail)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { candidateId, candidateEmail } = body;

    // ⚠️ NIENTE "modalities" e NIENTE "input_audio_transcription" qui.
    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "realtime=v1",
          "OpenAI-Project": process.env.OPENAI_PROJECT_ID!,
        },
        body: JSON.stringify({
          expires_after: 60 * 60, // 1 ora
          // Il modello Realtime da usare
          model: process.env.OPENAI_REALTIME_MODEL!,
          // Configurazione della sessione iniziale
          session: {
            type: "realtime",
            model: process.env.OPENAI_REALTIME_MODEL!,
            instructions:
              "You are LUMA, the Language Understanding Mastery Assistant of British Institutes. Speak clearly in English and be friendly and professional. Keep answers concise and focus on spoken interaction.",
            audio: {
              // abilita l'output audio con una voce standard
              output: {
                voice: "alloy",
              },
            },
            // metadati opzionali
            metadata: {
              candidateId: candidateId ?? undefined,
              candidateEmail: candidateEmail ?? undefined,
            },
          },
        }),
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.error(
        "Error from OpenAI when creating client secret:",
        response.status,
        response.statusText,
        data
      );
      return NextResponse.json(
        {
          error: "Failed to create client secret",
          details: data ?? response.statusText,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ client_secret: data?.value });
  } catch (error: any) {
    console.error(
      "Error from OpenAI when creating client secret:",
      JSON.stringify(error, null, 2)
    );
    return NextResponse.json(
      {
        error: "Failed to create client secret",
        details: error?.error ?? error,
      },
      { status: 500 }
    );
  }
}
