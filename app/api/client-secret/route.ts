// app/api/client-secret/route.ts
import { NextResponse } from "next/server";

export const maxDuration = 300;

export async function POST(_req: Request) {
  try {
    const { OPENAI_API_KEY, OPENAI_REALTIME_MODEL } = process.env;

    if (!OPENAI_API_KEY || !OPENAI_REALTIME_MODEL) {
      console.error("Missing OpenAI env vars", {
        hasApiKey: !!OPENAI_API_KEY,
        hasRealtimeModel: !!OPENAI_REALTIME_MODEL,
      });
      return NextResponse.json(
        { error: "Missing required OpenAI configuration" },
        { status: 500 }
      );
    }

    // 🔹 Chiamata diretta all’endpoint ufficiale delle Realtime sessions
    const openaiRes = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "realtime=v1",
        },
        body: JSON.stringify({
          model: OPENAI_REALTIME_MODEL,
          // Per ora niente metadata / impostazioni extra.
          // Possiamo aggiungerle dopo quando tutto funziona.
        }),
      }
    );

    if (!openaiRes.ok) {
      const errorText = await openaiRes.text();
      console.error(
        "OpenAI client-secret error:",
        openaiRes.status,
        errorText
      );
      return NextResponse.json(
        {
          error: "Failed to create client secret",
          details: errorText,
        },
        { status: 500 }
      );
    }

    const data = await openaiRes.json();

    // La risposta Realtime torna come { client_secret: { value, ... } }
    const clientSecret =
      data?.client_secret?.value ??
      data?.client_secret ??
      data?.value ??
      null;

    if (!clientSecret) {
      console.error("client_secret missing in OpenAI response:", data);
      return NextResponse.json(
        { error: "client_secret missing in OpenAI response" },
        { status: 500 }
      );
    }

    return NextResponse.json({ client_secret: clientSecret });
  } catch (err) {
    console.error("OpenAI client secret error:", err);
    return NextResponse.json(
      { error: "Failed to create client secret" },
      { status: 500 }
    );
  }
}
