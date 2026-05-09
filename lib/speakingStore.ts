import fs from "fs/promises";
import path from "path";

export type SpeakingEvent = { id: string; sessionId: string; role: "learner"|"assistant"; text: string; isFinal: boolean; sourceEventId: string; createdAt: string; metadata?: Record<string, unknown> };

const DIR = path.join(process.cwd(), ".data", "speaking");
const fileFor = (sessionId: string) => path.join(DIR, `${sessionId}.json`);

export async function appendSpeakingEvent(e: SpeakingEvent) {
  await fs.mkdir(DIR, { recursive: true });
  const f = fileFor(e.sessionId);
  let rows: SpeakingEvent[] = [];
  try { rows = JSON.parse(await fs.readFile(f, "utf8")); } catch {}
  if (rows.some((r) => r.sourceEventId === e.sourceEventId)) return;
  rows.push(e);
  await fs.writeFile(f, JSON.stringify(rows, null, 2));
}

export async function getSpeakingEvents(sessionId: string) {
  const f = fileFor(sessionId);
  try { return JSON.parse(await fs.readFile(f, "utf8")) as SpeakingEvent[]; } catch { return []; }
}
