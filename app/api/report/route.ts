import { NextRequest, NextResponse } from "next/server";

import { generateCanonicalSpeakingReport } from "@/lib/report/generateCanonicalSpeakingReport";

function validatePayload(body: any) {
  if (typeof body?.sessionId !== "string") return false;
  const sessionId = body.sessionId.trim();
  return sessionId.length > 0 && sessionId.toLowerCase() !== "null";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!validatePayload(body)) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid sessionId", reason: "invalid_session_id" },
        { status: 400 },
      );
    }

    const result = await generateCanonicalSpeakingReport(String(body.sessionId));
    return NextResponse.json(result.payload, { status: result.status });
  } catch (err) {
    console.error("Error handling /api/report request", err);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
