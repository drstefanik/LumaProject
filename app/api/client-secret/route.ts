import OpenAI from "openai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const apiKey = process.env.OPENAI_API_KEY;
const realtimeModel = process.env.OPENAI_REALTIME_MODEL;
const projectId = process.env.OPENAI_PROJECT_ID;

const BASE_PROMPT =
  "You are LUMA, an English speaking test examiner for British Institutes. Conduct a CEFR-aligned speaking test and at the end output a detailed evaluation in JSON with fields: candidate_name, cefr_level, accent, strengths, weaknesses, recommendations, overall_comment.";

export async function POST() {
  if (!apiKey || !realtimeModel) {
    return NextResponse.json(
      {
        error: "Missing required OpenAI configuration.",
        missing: {
          OPENAI_API_KEY: !!apiKey,
          OPENAI_REALTIME_MODEL: !!realtimeModel,
        },
      },
      { status: 500 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey });
    const session = await (
      openai as OpenAI & {
        clientSecrets: {
          create: (params: {
            project: string;
            display_name: string;
            expires_after: { anchor: "now"; duration: "1h" };
            session: {
              type: "realtime";
              model: string;
              modalities: string[];
              input_audio_transcription: { enabled: boolean };
            };
          }) => Promise<{
            client_secret?: { value?: string; expires_at?: number };
          }>;
        };
      }
    ).clientSecrets.create({
      project: projectId!,
      display_name: "LUMA Realtime Session",
      expires_after: {
        anchor: "now",
        duration: "1h",
      },
      session: {
        type: "realtime",
        model: realtimeModel,
        modalities: ["audio", "text"],
        input_audio_transcription: { enabled: true },
      },
    });

    if (!session.client_secret?.value) {
      console.error("No client secret returned from OpenAI", session);
      return NextResponse.json(
        { error: "Failed to create client secret" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      client_secret: session.client_secret.value,
      expires_at: session.client_secret.expires_at,
    });
  } catch (err) {
    console.error("Internal error creating client secret:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
