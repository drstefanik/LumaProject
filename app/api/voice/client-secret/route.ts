// app/api/client-secret/route.ts
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const apiKey = process.env.OPENAI_API_KEY;
const projectId = process.env.OPENAI_PROJECT_ID;

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
          model: "gpt-realtime",
          // niente prompt qui: lo settiamo dal client con session.update
          // se vuoi puoi mettere delle istruzioni di base:
          // instructions: "You are LUMA, the AI speaking examiner for British Institutes.",
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
    // /realtime/client_secrets restituisce { value, expires_at, session }
    const clientSecret = data.value;
    const expiresAt = data.expires_at;

    return NextResponse.json({
      client_secret: clientSecret,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error("Internal error creating client secret:", err);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}
