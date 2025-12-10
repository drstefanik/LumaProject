import OpenAI from "openai";
import { NextResponse } from "next/server";

export const maxDuration = 300;

const DEFAULT_REALTIME_MODEL = "gpt-4o-realtime-preview-2024-12-17";
type RealtimeModel =
  | "gpt-4o-realtime-preview"
  | "gpt-4o-realtime-preview-2024-10-01"
  | "gpt-4o-realtime-preview-2024-12-17"
  | "gpt-4o-mini-realtime-preview"
  | "gpt-4o-mini-realtime-preview-2024-12-17";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  project: process.env.OPENAI_PROJECT_ID,
});

export async function POST(req: Request) {
  const { OPENAI_API_KEY, OPENAI_REALTIME_MODEL, NEXT_PUBLIC_REALTIME_MODEL } =
    process.env;

  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  const model: RealtimeModel =
    (OPENAI_REALTIME_MODEL ?? NEXT_PUBLIC_REALTIME_MODEL ?? DEFAULT_REALTIME_MODEL) as RealtimeModel;

  let candidateId: string | undefined;
  let candidateEmail: string | undefined;

  try {
    const body = await req.json();
    candidateId = body?.candidateId ?? undefined;
    candidateEmail = body?.candidateEmail ?? undefined;
  } catch {
    // Request bodies are optional; ignore JSON parse errors
  }

  try {
    const session = await openai.beta.realtime.sessions.create({
      model,
      modalities: ["text", "audio"],
      voice: "alloy",
      turn_detection: { type: "server_vad" },
      input_audio_transcription: { model: "gpt-4o-transcribe" },
      client_secret: {
        expires_at: {
          anchor: "created_at",
          seconds: 60 * 60,
        },
      },
      instructions: [
        "You are LUMA, the Language Understanding Mastery Assistant of British Institutes.",
        candidateId ? `Candidate ID: ${candidateId}.` : undefined,
        candidateEmail ? `Candidate email: ${candidateEmail}.` : undefined,
      ]
        .filter(Boolean)
        .join(" \n"),
    });

    const clientSecretValue = session.client_secret?.value;

    if (!clientSecretValue) {
      console.error("Missing client_secret in OpenAI response:", session);
      return NextResponse.json(
        { error: "Client secret missing in response" },
        { status: 502 }
      );
    }

    return NextResponse.json({ client_secret: clientSecretValue });
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status ?? 500;
    const message = (error as Error)?.message ?? "Unknown error";
    const errorBody = (error as { error?: unknown; response?: { body?: unknown } })
      ?.error ?? (error as { response?: { body?: unknown } })?.response?.body;

    console.error("OpenAI client-secret error:", status, message, errorBody);

    return NextResponse.json(
      {
        error: "Failed to create client secret",
        details: message,
        openai: errorBody,
      },
      { status }
    );
  }
}
