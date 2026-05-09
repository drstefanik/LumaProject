import Airtable from "airtable";

if (!process.env.AIRTABLE_API_KEY) {
  console.warn("Warning: AIRTABLE_API_KEY is not set.");
}
if (!process.env.AIRTABLE_BASE_ID) {
  console.warn("Warning: AIRTABLE_BASE_ID is not set.");
}

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY!,
}).base(process.env.AIRTABLE_BASE_ID!);

// 🔹 Tabella anagrafica candidati (LUMASpeakingCandidates)
const CANDIDATE_TABLE =
  process.env.AIRTABLE_CANDIDATE_TABLE || "LUMASpeakingCandidates";

export const speakingCandidatesTable = () => base(CANDIDATE_TABLE);

// 🔹 Tabella report (Luma Reports)
const LUMA_REPORTS_TABLE =
  process.env.LUMA_REPORTS_TABLE || "Luma Reports";

export const lumaReportsTable = () => base(LUMA_REPORTS_TABLE);

// 🔹 Alias di compatibilità (se da qualche parte usi ancora reportsTable)
export const reportsTable = () =>
  base(process.env.AIRTABLE_REPORT_TABLE || LUMA_REPORTS_TABLE);

const LUMA_TRANSCRIPT_EVENTS_TABLE =
  process.env.LUMA_TRANSCRIPT_EVENTS_TABLE || "LumaTranscriptEvents";

export const lumaTranscriptEventsTable = () => base(LUMA_TRANSCRIPT_EVENTS_TABLE);

// ======================
//  REPORT SAVE
// ======================

type LumaReportRecord = {
  reportId?: string;
  candidateId?: string;
  candidateRecordId?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  emailKeyNormalized?: string;
  cefrLevel?: string;
  accent?: string;
  strengths?: string[] | string;
  weaknesses?: string[] | string;
  recommendations?: string[] | string;
  overallComment?: string;
  reportStatus?: string;
  reportGeneratedAt?: string;
  reportVersion?: string;
  reportSource?: string;
  blockedReason?: string | null;
  learnerWordCount?: number;
  learnerTurnCount?: number;
  assistantTurnCount?: number;
  confidenceScore?: string;
  transcriptIntegrity?: string;
  technicalStatus?: string;
  canonicalReportJson?: string;
  evidenceMapJson?: string;
  integrityLogJson?: string;
  rubricCoverageJson?: string;
  evidenceQuotesJson?: string;
  finalizedTranscriptJson?: string;
  reportIsGrounded?: boolean;
  hallucinationRiskFlag?: boolean;
  rawJson: string;
};

export async function saveLumaReport(record: LumaReportRecord) {
  const normalizedEmail = (record.emailKeyNormalized ?? record.email).trim().toLowerCase();
  const fields: Record<string, any> = {
    CandidateEmail: record.email,
    EmailKeyNormalized: normalizedEmail,
    CEFR_Level: record.cefrLevel ?? null,
    Accent: record.accent ?? null,
    Strengths: Array.isArray(record.strengths)
      ? record.strengths.join("\n")
      : record.strengths ?? null,
    Weaknesses: Array.isArray(record.weaknesses)
      ? record.weaknesses.join("\n")
      : record.weaknesses ?? null,
    Recommendations: Array.isArray(record.recommendations)
      ? record.recommendations.join("\n")
      : record.recommendations ?? null,
    OverallComment: record.overallComment ?? null,
    ReportStatus: record.reportStatus ?? "generated",
    ReportGeneratedAt: record.reportGeneratedAt ?? new Date().toISOString(),
    ReportVersion: record.reportVersion ?? "v1",
    ReportSource: record.reportSource ?? "realtime_finalize",
    BlockedReason: record.blockedReason ?? null,
    LearnerWordCount: record.learnerWordCount ?? null,
    LearnerTurnCount: record.learnerTurnCount ?? null,
    AssistantTurnCount: record.assistantTurnCount ?? null,
    ConfidenceScore: record.confidenceScore ?? null,
    TranscriptIntegrity: record.transcriptIntegrity ?? null,
    TechnicalStatus: record.technicalStatus ?? "ok",
    CanonicalReportJson: record.canonicalReportJson ?? record.rawJson,
    EvidenceMapJson: record.evidenceMapJson ?? null,
    IntegrityLogJson: record.integrityLogJson ?? null,
    RubricCoverageJson: record.rubricCoverageJson ?? null,
    EvidenceQuotesJson: record.evidenceQuotesJson ?? null,
    FinalizedTranscriptJson: record.finalizedTranscriptJson ?? null,
    ReportIsGrounded: record.reportIsGrounded ?? null,
    HallucinationRiskFlag: record.hallucinationRiskFlag ?? null,
    RawEvaluationText: record.rawJson,
  };

  if (record.candidateRecordId && process.env.AIRTABLE_ENABLE_CANDIDATE_LINK === "true") {
    fields.Candidate = [record.candidateRecordId];
  }

  console.log("[Airtable] LUMA report fields", fields);

  const toMinimalWritableFields = () => ({
    CandidateEmail: fields.CandidateEmail,
    CEFR_Level: fields.CEFR_Level,
    Accent: fields.Accent,
    Strengths: fields.Strengths,
    Weaknesses: fields.Weaknesses,
    Recommendations: fields.Recommendations,
    OverallComment: fields.OverallComment,
    RawEvaluationText: fields.RawEvaluationText,
    ComplianceStopReason: undefined,
    ReportStatus: fields.ReportStatus,
  });

  const toFinalMinimalFallbackFields = () => ({
    CandidateEmail: fields.CandidateEmail,
    RawEvaluationText: fields.RawEvaluationText,
    OverallComment: fields.OverallComment,
    ReportStatus: fields.ReportStatus,
  });

  try {
    const created = await lumaReportsTable().create([{ fields }]);
    return created[0]?.getId?.() ?? null;
  } catch (error: any) {
    console.warn("[Airtable] full payload rejected; retrying with minimal writable payload", {
      message: String(error?.message ?? ""),
      error,
    });
    try {
      const created = await lumaReportsTable().create([{ fields: toMinimalWritableFields() }]);
      return created[0]?.getId?.() ?? null;
    } catch (fallbackError: any) {
      console.warn("[Airtable] minimal writable payload rejected; retrying with final minimal payload", {
        message: String(fallbackError?.message ?? ""),
        error: fallbackError,
      });
      const created = await lumaReportsTable().create([{ fields: toFinalMinimalFallbackFields() }]);
      return created[0]?.getId?.() ?? null;
    }
  }
}

export async function resolveSpeakingCandidateEmail(candidateRecordId: string) {
  const normalizedId = typeof candidateRecordId === "string" ? candidateRecordId.trim() : "";
  if (!normalizedId) return null;

  try {
    const candidateRecord = await speakingCandidatesTable().find(normalizedId);
    const email = String(candidateRecord.get("Email") ?? "").trim();
    if (!email) return null;

    return {
      email,
      emailKeyNormalized: email.toLowerCase(),
      candidateRecordId: normalizedId,
    };
  } catch (error) {
    console.warn("[Airtable] unable to resolve speaking candidate email", {
      candidateRecordId: normalizedId,
      error,
    });
    return null;
  }
}

type TranscriptEventRecord = {
  eventId: string;
  reportId?: string;
  candidateId?: string;
  role: "learner" | "assistant";
  text: string;
  isFinal: boolean;
  sourceEventId: string;
  eventCreatedAt: string;
  metadataJson?: string;
};

export async function saveTranscriptEvent(record: TranscriptEventRecord) {
  const fields: Record<string, any> = {
    EventID: record.eventId,
    ReportID: record.reportId ?? null,
    CandidateID: record.candidateId ?? null,
    Role: record.role,
    Text: record.text,
    IsFinal: record.isFinal,
    SourceEventID: record.sourceEventId,
    EventCreatedAt: record.eventCreatedAt,
    MetadataJson: record.metadataJson ?? null,
  };
  await lumaTranscriptEventsTable().create([{ fields }]);
}
