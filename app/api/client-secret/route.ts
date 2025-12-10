import { NextResponse } from "next/server";

export const maxDuration = 300;

type ClientSecretResponse = {
  id: string;
  object: string;
  value?: string;
  created_at?: number;
  expires_at?: number;
  session?: unknown;
};

export async function POST(req: Request) {
  try {
    // Controllo variabili d'ambiente fondamentali
    const missing = {
      OPENAI_API_KEY: !process.env.OPENAI_API_KEY,
      OPENAI_PROJECT_ID: !process.env.OPENAI_PROJECT_ID,
      OPENAI_REALTIME_MODEL: !process.env.OPENAI_REALTIME_MODEL,
    };

    if (Object.values(missing).some(Boolean)) {
      console.error("Missing OpenAI env vars:", missing);
      return NextResponse.json(
        { error: "Missing required OpenAI configuration", missing },
        { status: 500 }
      );
    }

    // Eventuali dati sul candidato (facoltativi)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { candidateId, candidateEmail } = body ?? {};

    // Configurazione della sessione Realtime che vogliamo ottenere
    const sessionConfig = {
      session: {
        type: "realtime",
        model: process.env.OPENAI_REALTIME_MODEL!, // es. "gpt-4o-realtime-preview"
        audio: {
          output: {
            voice: "alloy",
          },
        },
        metadata: {
          candidateId: candidateId ?? null,
          candidateEmail: candidateEmail ?? null,
        },
      },
    };

    // ✅ Chiamata all'endpoint corretto per creare il client secret
    const secretResponse = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sessionConfig),
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

    const secretData = (await secretResponse.json()) as ClientSecretResponse;

    // L'ephemeral key è nel campo `value`
    if (!secretData.value) {
      console.error("Client secret value missing in response", secretData);
      return NextResponse.json(
        { error: "Client secret missing in response" },
        { status: 500 }
      );
    }

    // Il front-end si aspetta `client_secret`
    return NextResponse.json({
      client_secret: secretData.value,
    });
  } catch (error) {
    console.error("Internal error creating client secret:", error);
    return NextResponse.json(
      { error: "Failed to create client secret" },
      { status: 500 }
    );
  }
}
