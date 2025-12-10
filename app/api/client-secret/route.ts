import OpenAI from "openai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const apiKey = process.env.OPENAI_API_KEY;
const realtimeModel = process.env.OPENAI_REALTIME_MODEL;
const projectId = process.env.OPENAI_PROJECT_ID;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  project: process.env.OPENAI_PROJECT_ID,
});

const BASE_PROMPT =
  "You are LUMA, an English speaking test examiner for British Institutes. Conduct a CEFR-aligned speaking test and at the end output a detailed evaluation in JSON with fields: candidate_name, cefr_level, accent, strengths, weaknesses, recommendations, overall_comment.";

export async function POST() {
  if (!apiKey || !projectId || !realtimeModel) {
    return NextResponse.json(
      {
        error: "Missing required OpenAI configuration.",
        missing: {
          OPENAI_API_KEY: !!apiKey,
          OPENAI_PROJECT_ID: !!projectId,
          OPENAI_REALTIME_MODEL: !!realtimeModel,
        },
      },
      { status: 500 }
    );
  }

  try {
    const clientSecret = await openai.clientSecrets.create({
      project: process.env.OPENAI_PROJECT_ID!,
      display_name: "LUMA Realtime Session",
      expires_after: {
        anchor: "now",
        duration: "1h",
      },
      session: {
        type: "realtime",
        model: process.env.OPENAI_REALTIME_MODEL!,
        modalities: ["audio", "text"],
        input_audio_transcription: { enabled: true },
      },
    });

    return NextResponse.json({
      client_secret: clientSecret.secret,
    });
  } catch (err) {
    console.error("Internal error creating client secret:", err);
    return NextResponse.json(
      { error: "Failed to create client secret" },
      { status: 500 }
    );
  }
}
