import { NextResponse } from "next/server";

export async function POST(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, finalize: true }) });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
