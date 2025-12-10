import { NextResponse } from "next/server";

export const maxDuration = 300;

// POST /api/client-secret
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

    // candidateId e candidateEmail sono opzionali, arrivano dal client
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { candidateId, candidateEmail } = body;

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          // necessario per Realtime v1
          "OpenAI-Beta": "realtime=v1",
          // se usi i Projects:
          "OpenAI-Project": process.env.OPENAI_PROJECT_ID as string,
        },
        body: JSON.stringify({
          expires_after: {
            anchor: "created_at",
            seconds: 60 * 60, // 1 ora
          },
          session: {
            type: "realtime",
            model: process.env.OPENAI_REALTIME_MODEL,
            instructions:
              "You are LUMA, the British Institutes speaking assistant. Speak only in English.",
            // metadata opzionale per tracciare chi è in sessione
            ...(candidateId || candidateEmail
              ? {
                  metadata: {
                    candidate_id: candidateId ?? undefined,
                    candidate_email: candidateEmail ?? undefined,
                  },
                }
              : {}),
          },
        }),
      }
    );

    if (!response.ok) {
      const details = await response.text();
      console.error(
        "Error from OpenAI when creating client secret:",
        details
      );
      return NextResponse.json(
        {
          error: "Failed to create client secret",
          details,
        },
        { status: 500 }
      );
    }

    const data = await response.json();

    // la risposta ha il client secret in `value`
    // https://platform.openai.com/docs/api-reference/realtime-sessions :contentReference[oaicite:1]{index=1}
    return NextResponse.json({ client_secret: data.value });
  } catch (error) {
    console.error("Internal error creating client secret:", error);
    return NextResponse.json(
      { error: "Failed to create client secret" },
      { status: 500 }
    );
  }
}
