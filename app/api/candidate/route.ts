import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_CANDIDATES = process.env.AIRTABLE_CANDIDATE_TABLE;

function validatePayload(body: any) {
  const required = [
    "firstName",
    "lastName",
    "email",
    "dateOfBirth",
    "country",
    "nativeLanguage",
    "testPurpose",
  ];

  for (const key of required) {
    if (!body?.[key] || typeof body[key] !== "string") {
      return `${key} is required`;
    }
  }

  if (body.privacyConsent !== true) {
    return "Privacy consent must be accepted";
  }

  return null;
}

export async function POST(req: NextRequest) {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_CANDIDATES) {
    return NextResponse.json(
      { error: "Airtable is not configured" },
      { status: 500 }
    );
  }

  const body = await req.json();
  const validationError = validatePayload(body);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const fields: Record<string, any> = {
    FirstName: body.firstName,
    LastName: body.lastName,
    Email: body.email,
    DateOfBirth: body.dateOfBirth,
    Country: body.country,
    NativeLanguage: body.nativeLanguage,
    TestPurpose: body.testPurpose,
    PrivacyConsent: true,
  };

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
        AIRTABLE_TABLE_CANDIDATES
      )}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: [{ fields }] }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Airtable error", errText);
      return NextResponse.json(
        { error: "Failed to save candidate in Airtable" },
        { status: 500 }
      );
    }

    const data = await res.json();
    const recordId = data.records?.[0]?.id as string | undefined;

    if (!recordId) {
      return NextResponse.json(
        { error: "Candidate saved but no record id returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({ candidateId: recordId });
  } catch (error: any) {
    console.error("Error saving candidate", error);
    return NextResponse.json(
      { error: "Failed to save candidate" },
      { status: 500 }
    );
  }
}
