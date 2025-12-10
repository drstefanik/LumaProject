import { NextResponse } from "next/server";

export const maxDuration = 300;

type OpenAIClientSecretResponse = {
  client_secret: string;
  id?: string;
  created_at?: number;
  expires_at?: number;
};

export async function POST(req: Request) {
  try {
    const { OPENAI_API_KEY } = process.env;

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    // Body opzionale con metadati candidato
    let candidateId: string | null = null;
    let candidateEmail: string | null = null;

    try {
      const body = await req.json();
      candidateId = body?.candidateId ?? null;
      candidateEmail = body?.candidateEmail ?? null;
    } catch {
      // niente body → va bene lo stesso
    }

    // ✅ Endpoint giusto, payload giusto: SOLO ttl + metadata
    const response = await fetch("https://api.openai.com/v1/client-secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ttl: 60 * 60, // 1 ora
        metadata: {
          candidate_id: candidateId,
          candidate_email: candidateEmail,
        },
      }),
    });

    const text = await response.text();

    if (!response.ok) {
      console.error(
        "OpenAI client-secret error:",
        response.status,
        text
      );
      return NextResponse.json(
        {
          error: "Failed to create client secret",
          details: text,
        },
        { status: response.status }
      );
    }

    let data: OpenAIClientSecretResponse;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Invalid JSON from OpenAI client-secrets:", e, text);
      return NextResponse.json(
        { error: "Invalid response from OpenAI" },
        { status: 500 }
      );
    }

    if (!data.client_secret) {
      console.error("Missing client_secret in response:", data);
      return NextResponse.json(
        { error: "Client secret missing in response" },
        { status: 500 }
      );
    }

    // Il front-end si aspetta `client_secret`
    return NextResponse.json({ client_secret: data.client_secret });
  } catch (error) {
    console.error("Internal error creating client secret:", error);
    return NextResponse.json(
      { error: "Failed to create client secret" },
      { status: 500 }
    );
  }
}
