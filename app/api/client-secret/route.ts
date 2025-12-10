import { NextResponse } from "next/server";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const missing = {
      OPENAI_API_KEY: !process.env.OPENAI_API_KEY,
      OPENAI_PROJECT_ID: !process.env.OPENAI_PROJECT_ID,
      OPENAI_REALTIME_MODEL: !process.env.OPENAI_REALTIME_MODEL,
    };

    if (Object.values(missing).some(Boolean)) {
      return NextResponse.json(
        { error: "Missing required OpenAI configuration" },
        { status: 500 }
      );
    }

    // Provo a leggere eventuali dati sul candidato (non obbligatori)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // estrai eventuali metadati dal body (facoltativo, ma utile)
    const { candidateId, candidateEmail } = body ?? {};

    // ✅ CREA IL CLIENT SECRET (NUOVA API CORRETTA)
    // Nessun "model", nessun "session", nessun "modalities".
    const secretResponse = await fetch(
      "https://api.openai.com/v1/client/secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ttl: 3600, // 1 ora
          metadata: {
            candidateId: candidateId ?? null,
            candidateEmail: candidateEmail ?? null,
          },
        }),
      }
    );

    if (!secretResponse.ok) {
      const errorText = await secretResponse.text();
      console.error(
        "Failed to create client secret:",
        secretResponse.status,
        errorText
      );
      return NextResponse.json(
        { error: "Failed to create client secret", details: errorText },
        { status: secretResponse.status }
      );
    }

    const secretData = (await secretResponse.json()) as {
      client_secret?: string;
    };

    if (!secretData.client_secret) {
      console.error("Client secret missing in response", secretData);
      return NextResponse.json(
        { error: "Client secret missing in response" },
        { status: 500 }
      );
    }

    // Il front-end si aspetta `client_secret`
    return NextResponse.json({
      client_secret: secretData.client_secret,
    });
  } catch (error) {
    console.error("Internal error creating client secret:", error);
    return NextResponse.json(
      { error: "Failed to create client secret" },
      { status: 500 }
    );
  }
}
