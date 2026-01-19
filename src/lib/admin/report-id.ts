export type ReportIdKind = "airtableRecordId" | "reportId" | "invalid";

const AIRTABLE_RECORD_ID_REGEX = /^rec[a-zA-Z0-9]{10,}$/;
const REPORT_ID_REGEX = /^REP-[A-Za-z0-9_-]+$/;
const INVALID_VALUES = new Set(["", "undefined", "null"]);

export function normalizeReportId(input: unknown): string {
  return String(input ?? "").trim();
}

export function classifyReportId(id: string): {
  kind: ReportIdKind;
  normalized: string;
} {
  const normalized = normalizeReportId(id);

  if (INVALID_VALUES.has(normalized)) {
    return { kind: "invalid", normalized };
  }

  if (AIRTABLE_RECORD_ID_REGEX.test(normalized)) {
    return { kind: "airtableRecordId", normalized };
  }

  if (REPORT_ID_REGEX.test(normalized)) {
    return { kind: "reportId", normalized };
  }

  return { kind: "reportId", normalized };
}
