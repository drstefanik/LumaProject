// app/api/client-secret/route.ts
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
      console.error("Missing OpenAI env vars:", missing);
      return NextResponse.json(
        { error: "Missing required OpenAI configuration" },
        { status: 500 }
      );
    }

    // opzionale: dati candidato (non influiscono sulla chiamata)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const { candidateId, candidateEmail } = body ?? {};

    // ✅ nuova API corretta: /v1/realtime/client-secrets
    const secretResponse = await fetch(
      "https://api.openai.com/v1/realtime/client-secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Project": process.env.OPENAI_PROJECT_ID as string,
        },
        body: JSON.stringify({
          // quanto dura il client secret (in secondi)
          ttl: 3600,
          // sessione minimale: SOLO type + model
          session: {
            type: "realtime",
            model: process.env.OPENAI_REALTIME_MODEL,
          },
          // ❌ niente session.metadata, niente session.modalities, ecc.
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

    const data = (await secretResponse.json()) as {
      client_secret?: string;
    };

    if (!data.client_secret) {
      console.error("Client secret missing in response", data);
      return NextResponse.json(
        { error: "Client secret missing in response" },
        { status: 500 }
      );
    }

    // Il front-end si aspetta `client_secret`
    return NextResponse.json({ client_secret: data.client_secret });
  } catch (error) {
    console.error("Internal error creating client secret:", error);
    return NextResponse.json(
      { error: "Failed to create client secret" },
      { status: 500 }
    );
  }
}
