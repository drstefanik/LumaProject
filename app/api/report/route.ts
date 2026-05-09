import { NextRequest, NextResponse } from "next/server";

import { generateCanonicalSpeakingReport } from "@/lib/report/generateCanonicalSpeakingReport";

function validatePayload(body: any) {
  return typeof body?.sessionId === "string" && body.sessionId.trim().length > 0;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!validatePayload(body)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const result = await generateCanonicalSpeakingReport(String(body.sessionId));
    return NextResponse.json(result.payload, { status: result.status });
  } catch (err) {
    console.error("Error handling /api/report request", err);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
