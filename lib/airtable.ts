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
  firstName?: string;
  lastName?: string;
  email: string;
  cefrLevel?: string;
  accent?: string;
  strengths?: string[] | string;
  weaknesses?: string[] | string;
  recommendations?: string[] | string;
  overallComment?: string;
  rawJson: string;
};

export async function saveLumaReport(record: LumaReportRecord) {
  const candidateName = `${record.firstName ?? ""} ${record.lastName ?? ""}`.trim();

  const fields: Record<string, any> = {
    Candidate: candidateName || undefined,
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
    RawEvaluationText: record.rawJson,
  };

  if (!candidateName) {
    delete fields.Candidate;
  }

  const created = await lumaReportsTable().create([{ fields }]);
  return created[0]?.getId?.() ?? null;
}
