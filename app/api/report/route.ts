import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_REPORT_TABLE =
  process.env.AIRTABLE_REPORT_TABLE || "LUMASpeakingReports";

export async function POST(req: NextRequest) {
  try {
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_REPORT_TABLE) {
      console.error("Missing Airtable env vars");
      return NextResponse.json(
        { ok: false, error: "Airtable not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const parsed = body.parsed || {};

    // Mappiamo il JSON di LUMA sui campi della tua tabella
    const fields: Record<string, any> = {
      CandidateId: parsed.candidate_id || "",
      Name: parsed.candidate_name || parsed.name || "",
      DateTime: body.created_at || new Date().toISOString(),
      Status: parsed.status || "Completed",
      Selected: parsed.selected ?? false,
      AccentDetected: parsed.accent || parsed.accent_detected || "",
      AccentOverall:
        parsed.accent_overall ||
        parsed.accent_comment ||
        parsed.overall_comment ||
        "",
      CEFR_Global:
        parsed.cefr_global || parsed.cefr_level || parsed.level || "",
      Score_Fluency:
        parsed.score_fluency ??
        parsed.fluency_score ??
        parsed.fluency ??
        null,
      Score_Pronunciation:
        parsed.score_pronunciation ??
        parsed.pronunciation_score ??
        parsed.pronunciation ??
        null,
      Score_Grammar:
        parsed.score_grammar ?? parsed.grammar_score ?? parsed.grammar ?? null,
      Score_Vocabulary:
        parsed.score_vocabulary ??
        parsed.vocabulary_score ??
        parsed.vocabulary ??
        null,
      Score_Coherence:
        parsed.score_coherence ??
        parsed.coherence_score ??
        parsed.coherence ??
        null,
      Strengths: (parsed.strengths || []).join("; "),
      Weaknesses: (parsed.weaknesses || []).join("; "),
      Recommendations: (parsed.recommendations || []).join("; "),
      RawTranscript:
        parsed.raw_transcript || body.transcript || body.rawText || "",
      LanguagePair: parsed.language_pair || "EN-??"
    };

    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
        AIRTABLE_REPORT_TABLE
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
