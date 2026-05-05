import { NextResponse } from "next/server";

export const runtime = "edge";
export const maxDuration = 300;

export async function POST() {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-1.5";

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OpenAI API key" },
        { status: 500 }
      );
    }

    console.log("[voice/client-secret] Creating realtime client secret", {
      model: REALTIME_MODEL,
    });

    const baseInstructions =
      "You are LUMA, the Language Understanding Mastery Assistant of British Institutes. Speak clearly in English, be friendly and professional, keep responses concise, and evaluate spoken English proficiency while maintaining a natural conversation.";
    const timeLimitInstructions = `
Regola importante sul tempo:
- L’utente ha un tempo massimo di 180 secondi per parlare.
- Puoi ricordare brevemente all’inizio che ha 3 minuti.
- Non dire mai che può continuare oltre questo limite.
- Quando il sistema comunica che il tempo è scaduto, devi interrompere gentilmente la fase di speaking.
- Dopo il tempo scaduto, non fare nuove domande aperte.
- Passa direttamente a un breve feedback finale sulla performance dell’utente.
- Il blocco tecnico del microfono è gestito dall’applicazione, ma tu devi rispettare il limite nella conversazione.`;

    const res = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expires_after: { anchor: "created_at", seconds: 600 },
          session: {
            type: "realtime",
            model: REALTIME_MODEL,
            audio: {
              output: {
                voice: "marin",
              },
            },
            instructions:
              `${baseInstructions}\n${timeLimitInstructions}`,
          },
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[voice/client-secret] OpenAI error", {
        status: res.status,
        body: errorText,
      });
      return NextResponse.json(
        { error: "Failed to create client secret" },
        { status: 502 }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      client_secret: data.value,
      value: data.value,
      expires_at: data.expires_at,
      model: REALTIME_MODEL,
      session: data.session,
    });
  } catch (error: any) {
    console.error("[voice/client-secret] Unexpected error", {
      message: error?.message,
    });
    return NextResponse.json(
      { error: "Unexpected error creating client secret" },
      { status: 500 }
    );
  }
}
