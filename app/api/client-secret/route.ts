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
    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(projectId ? { "OpenAI-Project": projectId } : {}),
        },
        body: JSON.stringify({
          expires_after: {
            seconds: 600,
          },
          session: {
            type: "realtime",
            model: realtimeModel,
            modalities: ["audio", "text"],
            voice: "alloy",
            instructions: BASE_PROMPT,
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Failed to create client secret", response.statusText, errorBody);
      return NextResponse.json(
        { error: "Failed to create client secret" },
        { status: 500 }
      );
    }

    const session = await response.json();

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
