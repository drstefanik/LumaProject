// app/api/voice/client-secret/route.ts
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const apiKey = process.env.OPENAI_API_KEY;
const projectId = process.env.OPENAI_PROJECT_ID as string;

if (!apiKey) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

if (!projectId) {
  throw new Error("Missing OPENAI_PROJECT_ID environment variable");
}

export async function POST(req: NextRequest) {
  try {
    const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Project": projectId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expires_after: {
          anchor: "created_at",
          seconds: 600, // token valido 10 minuti
        },
        session: {
          type: "realtime",

          // MODELLO CORRETTO PER AUDIO E WEBRTC
          model: "gpt-4o-realtime-preview",

          // NECESSARIO: senza questo OpenAI rifiuta con 400
          modalities: ["audio", "text"],

          // Config audio per input/output
          audio: {
            input_audio_format: "pcm16",    // richiesto
            output_audio_format: "pcm16",   // richiesto
            voice: "sage"                    // o marin, alloy...
          },

          // trascrizione voce utente
          input_audio_transcription: {
            model: "whisper-1",
          }
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Error creating client secret:", text);
      return new NextResponse(
        JSON.stringify({ error: "Failed to create client secret" }),
        { status: 500 }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      client_secret: data.value,
      expires_at: data.expires_at,
    });
  } catch (err) {
    console.error("Internal error creating client secret:", err);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}
