import Airtable from "airtable";

if (!process.env.AIRTABLE_API_KEY) {
  console.warn("Warning: AIRTABLE_API_KEY is not set.");
}

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY!
}).base(process.env.AIRTABLE_BASE_ID!);

export const reportsTable = () =>
  base(process.env.AIRTABLE_REPORT_TABLE!);
