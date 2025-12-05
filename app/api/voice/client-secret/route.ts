import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const model =
      process.env.OPENAI_REALTIME_MODEL || "gpt-realtime";

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const res = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          // 👇 QUI il formato corretto
          expires_after: {
            anchor: "now",
            seconds: 600
          },
          session: {
            type: "realtime",
            model,
            instructions:
              "You are LUMA (Language Understanding Mastery Assistant), the official speaking examiner AI for British Institutes. Conduct an English speaking exam and then output a JSON data event with type 'luma_speaking_report' containing a structured evaluation of the candidate's accent, CEFR level, scores (fluency, pronunciation, grammar, vocabulary, coherence), strengths, weaknesses, recommendations, and a short English summary of the conversation."
          }
        })
      }
    );

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
      expires_at: data.client_secret?.expires_at
    });
  } catch (err) {
    console.error("Internal error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
