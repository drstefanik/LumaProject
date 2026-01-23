import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

type TranscriptPayload = {
  reportId?: string;
  candidateId?: string;
  transcript: string;
  kind: "live" | "final";
  reason?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TranscriptPayload;

    if (!body || typeof body.transcript !== "string") {
      return NextResponse.json({ error: "Invalid transcript payload" }, { status: 400 });
    }

    const transcript = body.transcript.trim();
    if (!transcript) {
      return NextResponse.json({ error: "Transcript is empty" }, { status: 400 });
    }

    const safeReportId = body.reportId?.trim() || "unknown";
    const kind = body.kind === "final" ? "final" : "live";
    const fileName = `transcripts/${safeReportId}-${kind}-${Date.now()}.txt`;

    const blob = await put(fileName, transcript, {
      access: "public",
      contentType: "text/plain; charset=utf-8",
    });

    console.log("[/api/transcripts] Stored transcript", {
      reportId: body.reportId,
      candidateId: body.candidateId,
      kind,
      reason: body.reason,
      url: blob.url,
    });

    return NextResponse.json({ ok: true, url: blob.url });
  } catch (error) {
    console.error("[/api/transcripts] Failed to store transcript", error);
    return NextResponse.json(
      { error: "Failed to store transcript" },
      { status: 500 }
    );
  }
}
