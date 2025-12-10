import Airtable from "airtable";

if (!process.env.AIRTABLE_API_KEY) {
  console.warn("Warning: AIRTABLE_API_KEY is not set.");
}

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY!
}).base(process.env.AIRTABLE_BASE_ID!);

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
  cefrLevel?: string;
  accent?: string;
  globalScore?: number;
  rawJson: string;
};

export async function saveLumaReport(record: LumaReportRecord) {
  const table = lumaReportsTable();

  const fields: Record<string, any> = {
    "First Name": record.firstName,
    "Last Name": record.lastName,
    Email: record.email,
    "Date of Birth": record.dateOfBirth,
    "Native Language": record.nativeLanguage,
    Country: record.country,
    "Test Purpose": record.testPurpose,
    "Privacy Consent": record.consentPrivacy,
    "CEFR Level": record.cefrLevel,
    Accent: record.accent,
    "Global Score": record.globalScore,
    "Raw JSON": record.rawJson,
  };

  const created = await table.create([{ fields }]);
  return created[0]?.getId?.() ?? null;
}
