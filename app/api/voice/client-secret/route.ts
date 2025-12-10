import { NextResponse } from "next/server";

export const runtime = "edge";
export const maxDuration = 300;

export async function POST() {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const OPENAI_REALTIME_MODEL =
      process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime";

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OpenAI API key" },
        { status: 500 }
      );
    }

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
            model: OPENAI_REALTIME_MODEL,
            instructions:
              "You are LUMA, the Language Understanding Mastery Assistant of British Institutes. Speak clearly in English, be friendly and professional, keep responses concise, and evaluate spoken English proficiency while maintaining a natural conversation.",
          },
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: "Failed to create client secret", details: errorText },
        { status: 502 }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      client_secret: data.value,
      expires_at: data.expires_at,
      session: data.session,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Unexpected error creating client secret", details: error?.message },
      { status: 500 }
    );
  }
}
