import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const projectId = process.env.OPENAI_PROJECT_ID;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing OPENAI_PROJECT_ID" },
        { status: 500 }
      );
    }

    const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Project": projectId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-realtime",
        modalities: ["audio", "text"],
        output_modalities: ["audio"],
        audio: {
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          voice: "marin",
        },
        input_audio_transcription: {
          model: "whisper-1",
        },
        prompt: {
          id: "pmpt_693315189ff8819599b34f43a3aa97b30602c504a5e62400",
          version: "1",
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Error creating client secret:", text);
      return NextResponse.json(
        { error: "Failed to create client secret" },
        { status: 500 }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      client_secret: data.client_secret?.value,
      expires_at: data.client_secret?.expires_at,
      session: data.session,
    });
  } catch (err) {
    console.error("Internal error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
