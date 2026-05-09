import { NextResponse } from "next/server";

import { generateCanonicalSpeakingReport } from "@/lib/report/generateCanonicalSpeakingReport";

export async function POST(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    if (!sessionId?.trim()) {
      return NextResponse.json({ success: false, error: "Missing sessionId", reason: "invalid_session_id" }, { status: 400 });
    }

    const result = await generateCanonicalSpeakingReport(sessionId);
    return NextResponse.json(result.payload, { status: result.status });
  } catch (error: any) {
    console.error("[/api/speaking/sessions/[sessionId]/finalize] failed", {
      message: error?.message,
      stack: error?.stack,
      blockReason: error?.reason,
    });
    return NextResponse.json({ success: false, error: "Failed to finalize report", reason: error?.reason ?? "finalize_failed" }, { status: 500 });
  }
}
