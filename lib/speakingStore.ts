import fs from "fs/promises";
import path from "path";
import { saveTranscriptEvent } from "@/lib/airtable";

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
  try {
    await saveTranscriptEvent({
      eventId: e.id,
      candidateId: e.sessionId,
      role: e.role,
      text: e.text,
      isFinal: e.isFinal,
      sourceEventId: e.sourceEventId,
      eventCreatedAt: e.createdAt,
      metadataJson: JSON.stringify(e.metadata ?? {}),
    });
  } catch (error) {
    console.warn("[speakingStore] failed to persist transcript event to Airtable", error);
  }
}

export async function getSpeakingEvents(sessionId: string) {
  const f = fileFor(sessionId);
  try { return JSON.parse(await fs.readFile(f, "utf8")) as SpeakingEvent[]; } catch { return []; }
}
