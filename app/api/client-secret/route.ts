// app/api/client-secret/route.ts
import { NextResponse } from "next/server";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const missing = {
      OPENAI_API_KEY: !process.env.OPENAI_API_KEY,
      OPENAI_REALTIME_MODEL: !process.env.OPENAI_REALTIME_MODEL,
    };

    if (Object.values(missing).some(Boolean)) {
      console.error("Missing OpenAI env vars:", missing);
      return NextResponse.json(
        { error: "Missing required OpenAI configuration", missing },
        { status: 500 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const sessionResponse = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_REALTIME_MODEL,
          voice: "alloy",
        }),
      }
    );

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error(
        "Failed to create realtime session:",
        sessionResponse.status,
        errorText
      );
      return NextResponse.json(
        { error: "Failed to create client secret", details: errorText },
        { status: sessionResponse.status }
      );
    }

    const data = await sessionResponse.json();
    const clientSecret =
      data?.client_secret?.value ?? data?.client_secret ?? null;

    if (!clientSecret) {
      console.error("Client secret missing in response", data);
      return NextResponse.json(
        { error: "Client secret missing in response" },
        { status: 500 }
      );
    }

    return NextResponse.json({ client_secret: clientSecret });
  } catch (error) {
    console.error("Internal error creating client secret:", error);
    return NextResponse.json(
      { error: "Failed to create client secret" },
      { status: 500 }
    );
  }
}
