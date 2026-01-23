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
  recordId: string;
  reportId: string | null;
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

export async function getAdminByEmail(email: string) {
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

export async function countAdmins() {
  try {
    const tableName = process.env.AIRTABLE_TABLE_ADMINS;

    if (!tableName) {
      console.error("AIRTABLE_TABLE_ADMINS is missing.");
      return 0;
    }

    const params = new URLSearchParams();
    params.set("pageSize", "100");
    params.append("fields[]", "Email");

    const records = await fetchAllRecords<AdminUserFields>(tableName, params);
    if (!records) {
      return 0;
    }
    return records.length;
  } catch (err) {
    console.error("countAdmins error", err);
    return 0;
  }
}

export async function createAdmin(fields: {
  email: string;
  passwordHash: string;
  role?: string | null;
  fullName?: string | null;
  isActive: boolean;
}) {
  try {
    const tableName = process.env.AIRTABLE_TABLE_ADMINS;

    if (!tableName) {
      console.error("AIRTABLE_TABLE_ADMINS is missing.");
      return { ok: false, error: "AIRTABLE_TABLE_ADMINS missing" };
    }

    if (!fields.email) {
      console.error("createAdmin error: email is required");
      return { ok: false, error: "Email is required" };
    }

    if (!fields.passwordHash) {
      console.error("createAdmin error: passwordHash is required");
      return { ok: false, error: "Password hash is required" };
    }

    const response = await fetch(getTableUrl(tableName), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        records: [
          {
            fields: {
              Email: fields.email,
              PasswordHash: fields.passwordHash,
              Role: fields.role ?? undefined,
              FullName: fields.fullName ?? undefined,
              IsActive: fields.isActive,
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "Airtable admin create failed",
        response.status,
        errorText,
      );
      return { ok: false, error: "Airtable admin create failed" };
    }

    const data = (await response.json()) as AirtableListResponse<AdminUserFields>;
    return { ok: true, data };
  } catch (err) {
    console.error("createAdmin error", err);
    return { ok: false, error: "Internal error creating admin" };
  }
}

export async function createAudit(
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
  sort?: string | null;
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
  const lookupMethod = filterFormula ? "filterByFormula" : "list";
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
  if (records.length > 0) {
    const firstRecord = records[0];
    console.log("[admin reports list] sample ids", {
      recordId: firstRecord.id,
      reportId: firstRecord.fields.ReportID ?? null,
    });
  }
  console.log("[admin reports list] lookup", {
    baseId: baseId ?? null,
    tableName,
    idRequested: null,
    idType: "list",
    lookupMethod,
    totalRecords: records.length,
  });
  const sortKey = params.sort ?? "createdAt_desc";
  const sortedRecords = [...records].sort((a, b) => {
    if (sortKey.startsWith("createdAt")) {
      const getTimestamp = (record: AirtableRecord<ReportFields>) => {
        const value = record.fields.CreatedAt ?? record.createdTime ?? null;
        return value ? new Date(value).getTime() : null;
      };
      const aTime = getTimestamp(a);
      const bTime = getTimestamp(b);
      if (aTime == null && bTime == null) return 0;
      if (aTime == null) return 1;
      if (bTime == null) return -1;
      return sortKey === "createdAt_asc" ? aTime - bTime : bTime - aTime;
    }

    const getText = (
      record: AirtableRecord<ReportFields>,
      key: "ReportID" | "CandidateEmail" | "CEFR_Level" | "PDFStatus",
    ) => {
      const value = record.fields[key];
      return typeof value === "string" ? value.trim().toLowerCase() : null;
    };

    let aValue: string | null = null;
    let bValue: string | null = null;

    switch (sortKey) {
      case "reportId_asc":
      case "reportId_desc":
        aValue = getText(a, "ReportID");
        bValue = getText(b, "ReportID");
        break;
      case "candidateEmail_asc":
      case "candidateEmail_desc":
        aValue = getText(a, "CandidateEmail");
        bValue = getText(b, "CandidateEmail");
        break;
      case "cefr_asc":
      case "cefr_desc":
        aValue = getText(a, "CEFR_Level");
        bValue = getText(b, "CEFR_Level");
        break;
      case "pdfStatus_asc":
      case "pdfStatus_desc":
        aValue = getText(a, "PDFStatus");
        bValue = getText(b, "PDFStatus");
        break;
      default:
        return 0;
    }

    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    const comparison = aValue.localeCompare(bValue, undefined, { sensitivity: "base" });
    return sortKey.endsWith("_desc") ? -comparison : comparison;
  });

  const total = sortedRecords.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  const items: ReportListItem[] = sortedRecords
    .slice(start, end)
    .flatMap((record) => {
    const recordId = typeof record.id === "string" ? record.id.trim() : "";
    if (!recordId) {
      return [];
    }

    const reportId =
      typeof record.fields.ReportID === "string" && record.fields.ReportID.trim()
        ? record.fields.ReportID.trim()
        : null;

    return [
      {
        recordId,
        reportId,
        candidateEmail: record.fields.CandidateEmail ?? null,
        cefrLevel: record.fields.CEFR_Level ?? null,
        accent: record.fields.Accent ?? null,
        createdAt: record.fields.CreatedAt ?? record.createdTime ?? null,
        pdfUrl: record.fields.PDFUrl ?? null,
        pdfStatus: record.fields.PDFStatus ?? null,
        pdfGeneratedAt: record.fields.PDFGeneratedAt ?? null,
        examDate: record.fields.ExamDate ?? null,
      },
    ];
  });

  return { items, total, page, pageSize };
}

export async function getReportByRecordId(tableName: string, recordId: string) {
  const response = await fetch(`${getTableUrl(tableName)}/${recordId}`, {
    headers: getHeaders(),
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable request failed: ${response.status} ${errorText}`);
  }

  return (await response.json()) as AirtableRecord<ReportFields>;
}

export async function updateReportByRecordId(
  tableName: string,
  recordId: string,
  fields: Record<string, unknown>,
) {
  const response = await fetch(`${getTableUrl(tableName)}/${recordId}`, {
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

export async function getFirstReportByFormula(tableName: string, formula: string) {
  const params = new URLSearchParams();
  params.set("maxRecords", "1");
  params.set("filterByFormula", formula);

  const data = await fetchAirtable<ReportFields>(tableName, params);
  return data.records[0] ?? null;
}

export async function getReportByReportID(reportId: string) {
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

export async function updateReportByReportID(
  reportId: string,
  fields: Record<string, unknown>,
) {
  const tableName = process.env.LUMA_REPORTS_TABLE;

  if (!tableName) {
    throw new Error("LUMA_REPORTS_TABLE is missing.");
  }

  const record = await getReportByReportID(reportId);
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
