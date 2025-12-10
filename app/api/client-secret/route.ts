import { NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 300;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  project: process.env.OPENAI_PROJECT_ID,
});

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

    // cast ad any per evitare errori di tipo: la versione dei tipi OpenAI
    // che abbiamo non espone ancora la proprietà `.realtime`
    const realtimeClient = (openai as any).realtime;

    const secret = await realtimeClient.clientSecrets.create({
      // facciamo durare il client secret 1 ora
      expires_after: {
        anchor: "created_at",
        seconds: 3600,
      },
      // configurazione della sessione realtime
      session: {
        type: "realtime",
        // il modello viene dalle env
        model: process.env.OPENAI_REALTIME_MODEL!,
        // il modello risponde in audio (con transcript di default)
        output_modalities: ["audio"],
        // configurazione audio base; possiamo espandere dopo
        audio: {
          output: {
            voice: "alloy",
          },
        },
        // metadati utili per il tracciamento
        metadata: {
          candidateId: candidateId ?? null,
          candidateEmail: candidateEmail ?? null,
        },
      },
    });

    // ATTENZIONE: la risposta di clientSecrets.create ha la forma:
    // { expires_at, session, value }
    // Il front-end però si aspetta un campo "client_secret", quindi lo mappiamo.
    return NextResponse.json({
      client_secret: secret.value,
    });
  } catch (error) {
    console.error("Internal error creating client secret:", error);
    return NextResponse.json(
      { error: "Failed to create client secret" },
      { status: 500 }
    );
  }
}
