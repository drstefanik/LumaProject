import { NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 300;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    // Controllo variabili ambiente minime
    const missing: Record<string, boolean> = {
      OPENAI_API_KEY: !process.env.OPENAI_API_KEY,
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

    // Provo a leggere eventuali dati sul candidato (non obbligatori)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { candidateId, candidateEmail } = body ?? {};

    // ✅ Usa la nuova API corretta: openai.clientSecrets.create
    // NIENTE "model", NIENTE "session.modalities", ecc. qui.
    const secret = await openai.clientSecrets.create({
      // facciamo durare il client secret 1 ora (3600 secondi)
      expires_after: {
        seconds: 3600,
      },
      // opzionale: puoi aggiungere qui la sessione custom in futuro
      // session: { ... }
    });

    // La risposta dell’SDK è del tipo:
    // { expires_at: number, session: {...}, value: string }
    // A noi interessa solo la stringa segreta
    return NextResponse.json({
      client_secret: secret.value,
      // opzionale: puoi loggare questi due per debug
      expires_at: secret.expires_at,
      candidateId: candidateId ?? null,
      candidateEmail: candidateEmail ?? null,
    });
  } catch (error: any) {
    console.error("Error from OpenAI when creating client secret:", error);

    const errPayload =
      error?.error
        ? { error: error.error.message, details: error.error }
        : { error: "Failed to create client secret" };

    return NextResponse.json(errPayload, { status: 500 });
  }
}
