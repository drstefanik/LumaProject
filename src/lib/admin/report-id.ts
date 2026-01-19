export type ReportIdKind = "airtableRecordId" | "reportId" | "invalid";

const INVALID_VALUES = new Set(["", "undefined", "null"]);

const REC_RE = /^rec[a-zA-Z0-9]+$/;
const REP_REC_RE = /^REP-rec[a-zA-Z0-9]+$/;

export function normalizeReportId(input: unknown): string {
  // Decode “safe”: se non è url-encoded, non succede nulla.
  const raw = String(input ?? "").trim();
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw;
  }
}

export function classifyReportId(id: string): {
  kind: ReportIdKind;
  normalized: string;
} {
  const normalized = normalizeReportId(id);

  if (INVALID_VALUES.has(normalized)) {
    return { kind: "invalid", normalized };
  }

  // recordId Airtable diretto
  if (REC_RE.test(normalized)) {
    return { kind: "airtableRecordId", normalized };
  }

  // ReportID Airtable con prefisso REP-
  if (REP_REC_RE.test(normalized)) {
    return { kind: "reportId", normalized };
  }

  return { kind: "invalid", normalized };
}
