import { NextResponse } from "next/server";
import { appendSpeakingEvent } from "@/lib/speakingStore";

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const body = await req.json();
  if (!sessionId || !body?.sourceEventId || !body?.role || !body?.text) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  await appendSpeakingEvent({ id: crypto.randomUUID(), sessionId, role: body.role, text: body.text, isFinal: body.isFinal !== false, sourceEventId: body.sourceEventId, createdAt: new Date().toISOString(), metadata: body.metadata ?? {} });
  return NextResponse.json({ ok: true });
}
