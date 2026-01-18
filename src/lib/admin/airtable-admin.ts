import "server-only";

const AIRTABLE_API_URL = "https://api.airtable.com/v0";

const baseId = process.env.AIRTABLE_BASE_ID;
const apiKey = process.env.AIRTABLE_API_KEY;

if (!apiKey) {
  console.warn("Warning: AIRTABLE_API_KEY is not set.");
}

if (!baseId) {
  console.warn("Warning: AIRTABLE_BASE_ID is not set.");
}

type AirtableRecord<TFields> = {
  id: string;
  fields: TFields;
  createdTime: string;
};

type AirtableListResponse<TFields> = {
  records: AirtableRecord<TFields>[];
  offset?: string;
};

type AdminUserFields = {
  Email?: string;
  PasswordHash?: string;
  Role?: string;
  IsActive?: boolean;
  FullName?: string;
};

type ReportFields = {
  ReportID?: string;
  CandidateEmail?: string;
  EmailKeyNormalized?: string;
  CEFR_Level?: string;
  Accent?: string;
  PDFUrl?: string;
  PDFStatus?: string;
  PDFGeneratedAt?: string;
  ExamDate?: string;
  CreatedAt?: string;
};

type ReportListItem = {
  reportId: string;
  candidateEmail: string | null;
  cefrLevel: string | null;
  accent: string | null;
  createdAt: string | null;
  pdfUrl: string | null;
  pdfStatus: string | null;
  pdfGeneratedAt: string | null;
  examDate: string | null;
};

function getHeaders() {
  if (!apiKey) {
    throw new Error("AIRTABLE_API_KEY is missing.");
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function getTableUrl(tableName: string) {
  if (!baseId) {
    throw new Error("AIRTABLE_BASE_ID is missing.");
  }

  return `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(tableName)}`;
}

function escapeFormulaValue(value: string) {
  return value.replace(/"/g, "\\\"");
}

async function fetchAirtable<TFields>(
  tableName: string,
  params: URLSearchParams,
): Promise<AirtableListResponse<TFields>> {
  const url = `${getTableUrl(tableName)}?${params.toString()}`;
  const response = await fetch(url, {
    headers: getHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable request failed: ${response.status} ${errorText}`);
  }

  return (await response.json()) as AirtableListResponse<TFields>;
}

async function fetchAllRecords<TFields>(
  tableName: string,
  params: URLSearchParams,
): Promise<AirtableRecord<TFields>[]> {
  const records: AirtableRecord<TFields>[] = [];
  let offset: string | undefined;

  do {
    if (offset) {
      params.set("offset", offset);
    } else {
      params.delete("offset");
    }

    const data = await fetchAirtable<TFields>(tableName, params);
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

function buildReportFilterFormula(params: {
  q?: string | null;
  cefr?: string | null;
  status?: string | null;
}) {
  const clauses: string[] = [];

  if (params.cefr) {
    clauses.push(`{CEFR_Level} = "${escapeFormulaValue(params.cefr)}"`);
  }

  if (params.status) {
    clauses.push(`{PDFStatus} = "${escapeFormulaValue(params.status)}"`);
  }

  if (params.q) {
    const escaped = escapeFormulaValue(params.q);
    const lower = `LOWER("${escaped}")`;
    const qFormula = `OR(
      FIND(${lower}, LOWER({EmailKeyNormalized} & "")),
      FIND(${lower}, LOWER({CandidateEmail} & "")),
      FIND("${escaped}", {ReportID} & "")
    )`;
    clauses.push(qFormula);
  }

  if (clauses.length === 0) {
    return null;
  }

  if (clauses.length === 1) {
    return clauses[0];
  }

  return `AND(${clauses.join(",")})`;
}

export async function getAdminUserByEmail(email: string) {
  const tableName = process.env.AIRTABLE_TABLE_ADMINS;

  if (!tableName) {
    throw new Error("AIRTABLE_TABLE_ADMINS is missing.");
  }

  const params = new URLSearchParams();
  params.set("maxRecords", "1");
  params.set("filterByFormula", `{Email} = "${escapeFormulaValue(email)}"`);
  params.append("fields[]", "Email");
  params.append("fields[]", "PasswordHash");
  params.append("fields[]", "Role");
  params.append("fields[]", "IsActive");
  params.append("fields[]", "FullName");

  const data = await fetchAirtable<AdminUserFields>(tableName, params);
  return data.records[0] ?? null;
}

export async function createAuditLog(
  actorEmail: string,
  action: string,
  reportId?: string,
) {
  const tableName = process.env.AIRTABLE_TABLE_AUDIT;

  if (!tableName) {
    throw new Error("AIRTABLE_TABLE_AUDIT is missing.");
  }

  const fields: Record<string, string> = {
    ActorEmail: actorEmail,
    Action: action,
  };

  if (reportId) {
    fields.ReportID = reportId;
  }

  const response = await fetch(getTableUrl(tableName), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ records: [{ fields }] }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable audit log failed: ${response.status} ${errorText}`);
  }
}

export async function listReports(params: {
  q?: string | null;
  cefr?: string | null;
  status?: string | null;
  page?: number | null;
  pageSize?: number | null;
}) {
  const tableName = process.env.LUMA_REPORTS_TABLE;

  if (!tableName) {
    throw new Error("LUMA_REPORTS_TABLE is missing.");
  }

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? 20));

  const queryParams = new URLSearchParams();
  queryParams.set("pageSize", "100");

  const filterFormula = buildReportFilterFormula(params);
  if (filterFormula) {
    queryParams.set("filterByFormula", filterFormula);
  }

  queryParams.append("fields[]", "ReportID");
  queryParams.append("fields[]", "CandidateEmail");
  queryParams.append("fields[]", "CEFR_Level");
  queryParams.append("fields[]", "Accent");
  queryParams.append("fields[]", "PDFUrl");
  queryParams.append("fields[]", "PDFStatus");
  queryParams.append("fields[]", "PDFGeneratedAt");
  queryParams.append("fields[]", "ExamDate");
  queryParams.append("fields[]", "CreatedAt");
  queryParams.append("fields[]", "EmailKeyNormalized");

  const records = await fetchAllRecords<ReportFields>(tableName, queryParams);
  const total = records.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  const items: ReportListItem[] = records.slice(start, end).map((record) => ({
    reportId: record.fields.ReportID ?? record.id,
    candidateEmail: record.fields.CandidateEmail ?? null,
    cefrLevel: record.fields.CEFR_Level ?? null,
    accent: record.fields.Accent ?? null,
    createdAt: record.fields.CreatedAt ?? record.createdTime ?? null,
    pdfUrl: record.fields.PDFUrl ?? null,
    pdfStatus: record.fields.PDFStatus ?? null,
    pdfGeneratedAt: record.fields.PDFGeneratedAt ?? null,
    examDate: record.fields.ExamDate ?? null,
  }));

  return { items, total, page, pageSize };
}

export async function getReportByReportId(reportId: string) {
  const tableName = process.env.LUMA_REPORTS_TABLE;

  if (!tableName) {
    throw new Error("LUMA_REPORTS_TABLE is missing.");
  }

  const params = new URLSearchParams();
  params.set("maxRecords", "1");
  params.set("filterByFormula", `{ReportID} = "${escapeFormulaValue(reportId)}"`);

  const data = await fetchAirtable<ReportFields>(tableName, params);
  return data.records[0] ?? null;
}

export async function updateReportByReportId(
  reportId: string,
  fields: Record<string, unknown>,
) {
  const tableName = process.env.LUMA_REPORTS_TABLE;

  if (!tableName) {
    throw new Error("LUMA_REPORTS_TABLE is missing.");
  }

  const record = await getReportByReportId(reportId);
  if (!record) {
    return null;
  }

  const response = await fetch(`${getTableUrl(tableName)}/${record.id}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable update failed: ${response.status} ${errorText}`);
  }

  return (await response.json()) as AirtableRecord<ReportFields>;
}
