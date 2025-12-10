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
const SPEAKING_CANDIDATES_TABLE =
  process.env.AIRTABLE_SPEAKING_CANDIDATES_TABLE || "LUMASpeakingCandidates";

export const speakingCandidatesTable = () => base(SPEAKING_CANDIDATES_TABLE);

// 🔹 Tabella report (Luma Reports)
const LUMA_REPORTS_TABLE =
  process.env.AIRTABLE_LUMA_REPORTS_TABLE || "Luma Reports";

export const lumaReportsTable = () => base(LUMA_REPORTS_TABLE);

// (per compatibilità, se da qualche parte usi ancora reportsTable)
export const reportsTable = () =>
  base(process.env.AIRTABLE_REPORT_TABLE!);

export const LUMA_REPORTS_TABLE =
  process.env.AIRTABLE_LUMA_REPORTS_TABLE || "Luma Reports";

export const lumaReportsTable = () => base(LUMA_REPORTS_TABLE);

type LumaReportRecord = {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth?: string;
  nativeLanguage?: string;
  country?: string;
  testPurpose?: string;
  consentPrivacy?: boolean;
};

export async function saveLumaCandidate(record: LumaCandidateRecord) {
  const fields: Record<string, any> = {
    // Questi nomi DEVONO combaciare coi campi della tabella LUMASpeakingCandidates.
    // Adatta se hai nomi diversi, ma la logica è questa.
    Candidate: `${record.firstName} ${record.lastName}`.trim(),
    CandidateEmail: record.email,
    DateOfBirth: record.dateOfBirth,
    NativeLanguage: record.nativeLanguage,
    Country: record.country,
    TestPurpose: record.testPurpose,
    PrivacyConsent: record.consentPrivacy,
  };

  const created = await speakingCandidatesTable().create([{ fields }]);
  return created[0]?.getId?.() ?? null;
}

// ======================
//  REPORT SAVE
// ======================

type LumaReportRecord = {
  candidateName: string;
  candidateEmail: string;
  cefrLevel?: string;
  accent?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  overallComment?: string;
  rawEvaluationText: string;
};

export async function saveLumaReport(record: LumaReportRecord) {
  const fields: Record<string, any> = {
    // Nomi esattamente come nello screenshot
    Candidate: record.candidateName,
    CandidateEmail: record.candidateEmail,
    CEFR_Level: record.cefrLevel,
    Accent: record.accent,
    Strengths: record.strengths?.join("\n"),
    Weaknesses: record.weaknesses?.join("\n"),
    Recommendations: record.recommendations?.join("\n"),
    OverallComment: record.overallComment,
    RawEvaluationText: record.rawEvaluationText,
    // ReportID e CreatedAt li gestisce Airtable (auto / formula), quindi NON li settiamo.
  };

  const created = await lumaReportsTable().create([{ fields }]);
  return created[0]?.getId?.() ?? null;
}
