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
  firstName?: string;
  lastName?: string;
  email: string;
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
  const fields: Record<string, any> = {
    CandidateID: record.candidateId ?? null,
    CandidateEmail: record.email,
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

  console.log("[Airtable] LUMA report fields", fields);

  const isComputedFieldError = (message: string) =>
    message.includes("UNKNOWN_FIELD_NAME") ||
    message.includes("cannot accept a value because the field is computed") ||
    message.includes("cannot be set") ||
    message.includes("read only");

  const toSafeLegacyFields = (withCreatedAt: boolean) => {
    const compatibilityFields = new Set([
      "CandidateEmail",
      "CEFR_Level",
      "Accent",
      "Strengths",
      "Weaknesses",
      "Recommendations",
      "OverallComment",
      "RawEvaluationText",
      "LiveTranscriptIncident",
      "ComplianceStopReason",
      "TranscriptUrl",
      "PDFStatus",
      "PDFUrl",
      ...(withCreatedAt ? ["CreatedAt"] : []),
    ]);

    const baseFields = Object.fromEntries(
      Object.entries(fields).filter(([key, value]) => compatibilityFields.has(key) && value !== undefined),
    );

    if (withCreatedAt && record.reportGeneratedAt) {
      baseFields.CreatedAt = record.reportGeneratedAt;
    }

    return baseFields;
  };

  try {
    const created = await lumaReportsTable().create([{ fields }]);
    return created[0]?.getId?.() ?? null;
  } catch (error: any) {
    const message = String(error?.message ?? "");
    if (!isComputedFieldError(message)) {
      throw error;
    }
    console.warn("[Airtable] computed/unknown/read-only fields detected; retrying with safe legacy field set");
    try {
      const created = await lumaReportsTable().create([{ fields: toSafeLegacyFields(true) }]);
      return created[0]?.getId?.() ?? null;
    } catch (fallbackError: any) {
      const fallbackMessage = String(fallbackError?.message ?? "");
      if (!isComputedFieldError(fallbackMessage)) throw fallbackError;
      console.warn("[Airtable] safe legacy payload still had computed/unknown/read-only fields; retrying without CreatedAt");
      const created = await lumaReportsTable().create([{ fields: toSafeLegacyFields(false) }]);
      return created[0]?.getId?.() ?? null;
    }
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
