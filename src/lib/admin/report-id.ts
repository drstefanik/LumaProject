export type ReportIdKind = "airtableRecordId" | "reportId" | "invalid";

const AIRTABLE_RECORD_ID_PREFIX = "rec";
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

  if (normalized.startsWith(AIRTABLE_RECORD_ID_PREFIX)) {
    return { kind: "airtableRecordId", normalized };
  }

  return { kind: "reportId", normalized };
}
