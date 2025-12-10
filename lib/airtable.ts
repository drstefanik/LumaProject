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
    // Nomi esattamente come nella tabella "Luma Reports"
    Candidate: record.candidateName,
    CandidateEmail: record.candidateEmail,
    CEFR_Level: record.cefrLevel,
    Accent: record.accent,
    Strengths: record.strengths?.join("\n"),
    Weaknesses: record.weaknesses?.join("\n"),
    Recommendations: record.recommendations?.join("\n"),
    OverallComment: record.overallComment,
    RawEvaluationText: record.rawEvaluationText,
    // ReportID e CreatedAt li gestisce Airtable
  };

  const created = await lumaReportsTable().create([{ fields }]);
  return created[0]?.getId?.() ?? null;
}
