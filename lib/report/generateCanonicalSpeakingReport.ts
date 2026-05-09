import fs from "fs/promises";
import path from "path";

import { saveLumaReport } from "@/lib/airtable";
import { openai } from "@/lib/openai";
import { getSpeakingEvents } from "@/lib/speakingStore";

const REPORT_MODEL = process.env.OPENAI_REPORT_MODEL || "gpt-4.1-mini";
const MIN_LEARNER_WORD_COUNT = 20;

export type CandidatePayload = { firstName?: string; lastName?: string; email?: string; nativeLanguage?: string; country?: string; testPurpose?: string };
export type TranscriptTurn = { id?: string; role: "learner" | "assistant"; text: string; atMs?: number; isFinal?: boolean };

export type CanonicalReport = {
  cefr_level: string | null;
  confidence: "low" | "medium" | "high";
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  overall_comment: string;
  evidence: {
    learner_quotes: Array<{ quote: string; supporting_utterance_ids: string[] }>;
    rubric_coverage: Record<string, string[] | "insufficient_evidence">;
  };
};

const fillerPatterns = [/good effort/i, /communicated effectively/i, /mostly accurate/i];

function countWords(t: string) { return t.trim().split(/\s+/).filter(Boolean).length; }
function asFinalLearner(turns: TranscriptTurn[]) {
  const seen = new Set<string>();
  return turns.filter((t, i) => {
    if (t.role !== "learner") return false;
    if (!t.text?.trim()) return false;
    if (t.isFinal === false) return false;
    const key = `${t.text.trim().toLowerCase()}|${t.atMs ?? i}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((t, i) => ({ ...t, id: t.id ?? `u_${i + 1}` }));
}

async function generateCanonicalReport(candidate: CandidatePayload, learnerTurns: TranscriptTurn[], assistantTurns: TranscriptTurn[]) {
  const prompt = [
    "Return ONLY valid JSON.",
    "Assess only learner utterances. Ignore assistant/system content.",
    "No score or CEFR claim without direct learner evidence.",
    "If insufficient evidence, use null for cefr_level and 'insufficient_evidence' in rubric_coverage.",
    "Do not use generic filler (e.g., good effort) unless tied to concrete quotes.",
    "Schema:",
    '{"cefr_level":string|null,"confidence":"low"|"medium"|"high","strengths":string[],"weaknesses":string[],"recommendations":string[],"overall_comment":string,"evidence":{"learner_quotes":[{"quote":string,"supporting_utterance_ids":string[]}],"rubric_coverage":{"grammar":string[]|"insufficient_evidence","vocabulary":string[]|"insufficient_evidence","fluency":string[]|"insufficient_evidence","pronunciation":string[]|"insufficient_evidence","coherence":string[]|"insufficient_evidence"}}}',
    "Candidate metadata:", JSON.stringify(candidate),
    "Learner utterances:", JSON.stringify(learnerTurns),
    "Assistant utterances (context only, not evidence):", JSON.stringify(assistantTurns),
  ].join("\n");

  const completion = await openai.responses.create({ model: REPORT_MODEL, input: [{ role: "user", content: prompt }] });
  const text = completion.output_text?.trim();
  if (!text) throw new Error("No report text returned from OpenAI");
  return JSON.parse(text) as CanonicalReport;
}

function validateCanonicalReport(report: CanonicalReport, learnerTurns: TranscriptTurn[]) {
  const learnerIds = new Set(learnerTurns.map((t) => t.id));
  for (const ev of report.evidence?.learner_quotes ?? []) {
    if (!ev.supporting_utterance_ids?.every((id) => learnerIds.has(id))) return "invalid_evidence_speaker_or_id";
  }
  const hasEvidence = (ids: string[] | "insufficient_evidence") => ids === "insufficient_evidence" ? false : ids.length > 0;
  const coverage = report.evidence?.rubric_coverage ?? {};
  if (report.cefr_level && !Object.values(coverage).some((v) => hasEvidence(v as any))) return "cefr_without_evidence";
  if (fillerPatterns.some((re) => re.test(report.overall_comment)) && (report.evidence?.learner_quotes?.length ?? 0) === 0) return "generic_filler_without_evidence";
  return null;
}

function hasCanonicalEvidence(report: CanonicalReport) {
  const quoteCount = report.evidence?.learner_quotes?.length ?? 0;
  const coverage = Object.values(report.evidence?.rubric_coverage ?? {});
  const hasCoverage = coverage.some((value) => Array.isArray(value) && value.length > 0);
  return quoteCount > 0 || hasCoverage;
}

export async function generateCanonicalSpeakingReport(sessionId: string) {
  const transcript = (await getSpeakingEvents(sessionId)).map((e) => ({ role: e.role, text: e.text, atMs: Date.parse(e.createdAt), isFinal: e.isFinal, id: e.id })) as TranscriptTurn[];
  const candidate: CandidatePayload = { firstName: "Candidate", lastName: sessionId, email: `${sessionId}@session.local` };
  const learnerTurns = asFinalLearner(transcript);
  const assistantTurns = transcript.filter((t) => t.role === "assistant" && t.text?.trim());
  const learnerWordCount = learnerTurns.reduce((a, t) => a + countWords(t.text), 0);

  console.log("[generateCanonicalSpeakingReport] integrity metrics", { sessionId, learnerUtterances: learnerTurns.length, assistantUtterances: assistantTurns.length, transcriptFinalized: true, learnerWordCount });

  if (!learnerTurns.length || learnerWordCount < MIN_LEARNER_WORD_COUNT) {
    await saveLumaReport({
      reportId: `RPT-${sessionId}-${Date.now()}`,
      candidateId: sessionId,
      email: candidate.email!,
      reportStatus: "incomplete",
      blockedReason: "insufficient_canonical_learner_evidence",
      reportGeneratedAt: new Date().toISOString(),
      reportVersion: "v1",
      reportSource: "speaking_finalize_api",
      learnerWordCount,
      learnerTurnCount: learnerTurns.length,
      assistantTurnCount: assistantTurns.length,
      transcriptIntegrity: "insufficient_evidence",
      technicalStatus: "ok",
      canonicalReportJson: JSON.stringify({ reason: "insufficient_canonical_learner_evidence" }),
      integrityLogJson: JSON.stringify({ checks: ["minimum_word_count"], blockedReason: "insufficient_canonical_learner_evidence" }),
      reportIsGrounded: false,
      hallucinationRiskFlag: true,
      rawJson: JSON.stringify({ reason: "insufficient_canonical_learner_evidence" }),
    });
    return { ok: false as const, status: 422, payload: { success: false, incomplete: true, message: "The session did not contain enough learner speech to generate a reliable report.", reason: "insufficient_canonical_learner_evidence" } };
  }

  const canonicalReport = await generateCanonicalReport(candidate, learnerTurns, assistantTurns);
  const blockReason = validateCanonicalReport(canonicalReport, learnerTurns);
  if (blockReason) {
    await saveLumaReport({
      reportId: `RPT-${sessionId}-${Date.now()}`,
      candidateId: sessionId,
      email: candidate.email!,
      reportStatus: "blocked",
      blockedReason: blockReason,
      reportGeneratedAt: new Date().toISOString(),
      reportVersion: "v1",
      reportSource: "speaking_finalize_api",
      learnerWordCount,
      learnerTurnCount: learnerTurns.length,
      assistantTurnCount: assistantTurns.length,
      confidenceScore: canonicalReport.confidence,
      transcriptIntegrity: "failed_validation",
      technicalStatus: "ok",
      canonicalReportJson: JSON.stringify(canonicalReport),
      evidenceMapJson: JSON.stringify(canonicalReport.evidence ?? {}),
      rubricCoverageJson: JSON.stringify(canonicalReport.evidence?.rubric_coverage ?? {}),
      evidenceQuotesJson: JSON.stringify(canonicalReport.evidence?.learner_quotes ?? []),
      integrityLogJson: JSON.stringify({ checks: ["evidence_validation"], blockedReason: blockReason }),
      reportIsGrounded: false,
      hallucinationRiskFlag: true,
      rawJson: JSON.stringify(canonicalReport),
    });
    console.log("[generateCanonicalSpeakingReport] blocked", { sessionId, blockReason, confidence: canonicalReport.confidence });
    return { ok: false as const, status: 422, payload: { success: false, incomplete: true, message: "The session did not contain enough reliable evidence to generate a final report.", reason: blockReason } };
  }

  const hasEvidence = hasCanonicalEvidence(canonicalReport);
  const safeCefrLevel = hasEvidence ? canonicalReport.cefr_level ?? undefined : undefined;
  const safeAccent: string = "insufficient_evidence";
  const safeNarrative = hasEvidence;
  const reportText = JSON.stringify(canonicalReport, null, 2);
  const reportId = `RPT-${sessionId}-${Date.now()}`;
  const airtableId = await saveLumaReport({
    reportId,
    candidateId: sessionId,
    email: candidate.email!,
    cefrLevel: safeCefrLevel,
    accent: safeAccent,
    strengths: safeNarrative ? canonicalReport.strengths : [],
    weaknesses: safeNarrative ? canonicalReport.weaknesses : [],
    recommendations: safeNarrative ? canonicalReport.recommendations : [],
    overallComment: safeNarrative ? canonicalReport.overall_comment : "",
    reportStatus: hasEvidence ? "generated" : "incomplete",
    reportGeneratedAt: new Date().toISOString(),
    reportVersion: "v1",
    reportSource: "speaking_finalize_api",
    learnerWordCount,
    learnerTurnCount: learnerTurns.length,
    assistantTurnCount: assistantTurns.length,
    confidenceScore: canonicalReport.confidence,
    transcriptIntegrity: "passed",
    technicalStatus: "ok",
    canonicalReportJson: reportText,
    evidenceMapJson: JSON.stringify(canonicalReport.evidence ?? {}),
    rubricCoverageJson: JSON.stringify(canonicalReport.evidence?.rubric_coverage ?? {}),
    evidenceQuotesJson: JSON.stringify(canonicalReport.evidence?.learner_quotes ?? []),
    finalizedTranscriptJson: JSON.stringify({ learner: learnerTurns, assistant: assistantTurns }),
    reportIsGrounded: hasEvidence,
    hallucinationRiskFlag: !hasEvidence || canonicalReport.confidence === "low",
    integrityLogJson: JSON.stringify({
      checks: ["final_learner_turns", "minimum_word_count", "evidence_validation"],
      blockedReason: null,
    }),
    rawJson: reportText,
  });

  const dir = path.join(process.cwd(), "report");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${sessionId}.json`), JSON.stringify({ sessionId, candidate, canonicalReport, transcript: learnerTurns }, null, 2));

  return { ok: true as const, status: 200, payload: { success: true, airtableId, reportText, meta: { cefrLevel: canonicalReport.cefr_level, confidence: canonicalReport.confidence } } };
}
