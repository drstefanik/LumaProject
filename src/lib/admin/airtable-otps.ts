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

type OtpFields = {
  Email?: string;
  OTPHash?: string;
  ExpiresAt?: string;
  IsUsed?: boolean;
  UsedAt?: string;
  CreatedBy?: string;
  Role?: string;
  CreatedAt?: string;
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
    throw new Error(
      `Airtable AdminOTPs schema mismatch or request failed: ${response.status} ${errorText}`,
    );
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

function assertOtpFields(fields: OtpFields) {
  const missing: string[] = [];

  if (!fields.Email) missing.push("Email");
  if (!fields.OTPHash) missing.push("OTPHash");
  if (!fields.ExpiresAt) missing.push("ExpiresAt");

  if (missing.length > 0) {
    throw new Error(
      `Invalid AdminOTPs schema: missing required fields (${missing.join(", ")})`,
    );
  }
}

function normalizeOtpRecord(record: AirtableRecord<OtpFields>) {
  const fields = record.fields ?? {};
  if (typeof fields.IsUsed === "undefined") {
    console.warn(
      "[admin-otp] IsUsed missing from Airtable fields; defaulting to false",
      {
        recordId: record.id,
        keys: Object.keys(fields),
      },
    );
  }

  return {
    ...record,
    fields: {
      ...fields,
      IsUsed: fields.IsUsed ?? false,
    },
  };
}

function getOtpTableName() {
  const tableName = process.env.AIRTABLE_TABLE_ADMIN_OTPS;

  if (!tableName) {
    throw new Error("AIRTABLE_TABLE_ADMIN_OTPS is missing.");
  }

  return tableName;
}

export async function createOtpInvite(fields: {
  email: string;
  otpHash: string;
  expiresAt: string;
  role?: string | null;
  createdBy: string;
}) {
  const response = await fetch(getTableUrl(getOtpTableName()), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      records: [
        {
          fields: {
            Email: fields.email,
            OTPHash: fields.otpHash,
            ExpiresAt: fields.expiresAt,
            IsUsed: false,
            CreatedBy: fields.createdBy,
            Role: fields.role ?? undefined,
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Airtable AdminOTPs create failed: ${response.status} ${errorText}`,
    );
  }

  return (await response.json()) as AirtableListResponse<OtpFields>;
}

export async function getLatestValidInviteByEmail(email: string) {
  const params = new URLSearchParams();
  params.set("maxRecords", "1");
  params.set(
    "filterByFormula",
    `AND({Email} = "${escapeFormulaValue(
      email,
    )}", {IsUsed} != TRUE(), IS_AFTER({ExpiresAt}, "${new Date().toISOString()}"))`,
  );
  params.append("fields[]", "Email");
  params.append("fields[]", "OTPHash");
  params.append("fields[]", "ExpiresAt");
  params.append("fields[]", "IsUsed");
  params.append("fields[]", "Role");
  params.append("fields[]", "CreatedAt");
  params.append("fields[]", "CreatedBy");
  params.append("fields[]", "UsedAt");
  params.set("sort[0][field]", "CreatedAt");
  params.set("sort[0][direction]", "desc");

  const data = await fetchAirtable<OtpFields>(getOtpTableName(), params);
  const record = data.records[0] ? normalizeOtpRecord(data.records[0]) : null;

  if (record) {
    assertOtpFields(record.fields);
  }

  return record;
}

export async function invalidatePreviousInvites(email: string) {
  const params = new URLSearchParams();
  params.set(
    "filterByFormula",
    `AND({Email} = "${escapeFormulaValue(email)}", {IsUsed} != TRUE())`,
  );
  params.append("fields[]", "Email");
  params.append("fields[]", "IsUsed");
  params.append("fields[]", "UsedAt");

  const records = await fetchAllRecords<OtpFields>(getOtpTableName(), params);
  if (records.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const response = await fetch(getTableUrl(getOtpTableName()), {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({
      records: records.map((record) => ({
        id: record.id,
        fields: {
          IsUsed: true,
          UsedAt: now,
        },
      })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Airtable AdminOTPs invalidate failed: ${response.status} ${errorText}`,
    );
  }
}

export async function markInviteUsed(recordId: string) {
  const response = await fetch(`${getTableUrl(getOtpTableName())}/${recordId}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({
      fields: {
        IsUsed: true,
        UsedAt: new Date().toISOString(),
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Airtable AdminOTPs update failed: ${response.status} ${errorText}`,
    );
  }

  const data = (await response.json()) as AirtableRecord<OtpFields>;
  const record = normalizeOtpRecord(data);
  assertOtpFields(record.fields);
  return record;
}
