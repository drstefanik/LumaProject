// app/api/voice/client-secret/route.ts
import OpenAI from "openai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const apiKey = process.env.OPENAI_API_KEY;
const projectId = process.env.OPENAI_PROJECT_ID as string;

if (!apiKey) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

if (!projectId) {
  throw new Error("Missing OPENAI_PROJECT_ID environment variable");
}

const openai = new OpenAI({ apiKey, project: projectId });

export async function POST() {
  try {
    const session = await openai.beta.realtime.sessions.create(
      {
        client_secret: {
          // Expire the ephemeral client token 10 minutes after creation.
          expires_at: {
            anchor: "created_at",
            seconds: 600,
          },
        },
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        voice: "sage",
        model: "gpt-4o-realtime-preview",
      },
      {
        headers: {
          "OpenAI-Beta": "realtime=v1",
        },
      }
    );

    if (!session.client_secret?.value) {
      console.error("No client secret returned from OpenAI", session);
      return new NextResponse(
        JSON.stringify({ error: "Failed to create client secret" }),
        { status: 500 }
      );
    }

    return NextResponse.json({
      client_secret: session.client_secret.value,
      expires_at: session.client_secret.expires_at,
    });
  } catch (err) {
    console.error("Internal error creating client secret:", err);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}
