import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME =
  process.env.AIRTABLE_LUMA_TABLE_NAME || "LUMA Reports";

export async function POST(req: NextRequest) {
  try {
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      console.error("Missing Airtable env vars");
      return NextResponse.json(
        { ok: false, error: "Airtable not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const fields: Record<string, any> = {
      Date: body.created_at || new Date().toISOString(),
      "Raw text": body.rawText || "",
      "JSON parsed": JSON.stringify(body.parsed ?? {}, null, 2)
    };

    if (body.parsed?.cefr_level) fields["CEFR level"] = body.parsed.cefr_level;
    if (body.parsed?.accent) fields["Accent"] = body.parsed.accent;
    if (body.parsed?.candidate_name)
      fields["Candidate"] = body.parsed.candidate_name;
    if (body.parsed?.overall_comment)
      fields["Overall comment"] = body.parsed.overall_comment;

    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
        AIRTABLE_TABLE_NAME
      )}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          records: [{ fields }]
        })
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Airtable error:", text);
      return NextResponse.json(
        { ok: false, error: "airtable_error", details: text },
        { status: 500 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ ok: true, airtable: data });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: err?.message || "unknown" },
      { status: 500 }
    );
  }
}
