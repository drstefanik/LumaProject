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
    const createdAt: string =
      body.created_at || new Date().toISOString();

    // ---- dati registrazione candidato ----
    const firstName: string =
      body.candidate_first_name ||
      parsed.candidate_first_name ||
      "";
    const lastName: string =
      body.candidate_last_name ||
      parsed.candidate_last_name ||
      "";
    const candidateName: string =
      body.candidate_name ||
      parsed.candidate_name ||
      `${firstName} ${lastName}`.trim();

    const candidateEmail: string =
      body.candidate_email ||
      parsed.candidate_email ||
      "";

    const birthDate: string =
      body.birth_date || parsed.birth_date || "";

    const nativeLanguage: string =
      body.native_language || parsed.native_language || "";

    const country: string =
      body.country || parsed.country || "";

    const testPurpose: string =
      body.test_purpose || parsed.test_purpose || "";

    const privacyAccepted: boolean =
      !!body.privacy_accepted || !!parsed.privacy_accepted;

    // ---- mappatura campi Airtable ----
    const fields: Record<string, any> = {
      // anagrafica candidato
      FirstName: firstName,
      LastName: lastName,
      Name: candidateName,
      CandidateEmail: candidateEmail,
      BirthDate: birthDate || null,
      NativeLanguage: nativeLanguage,
      Country: country,
      TestPurpose: testPurpose,
      PrivacyAccepted: privacyAccepted,

      // info sessione
      CandidateId: parsed.candidate_id || "",
      DateTime: createdAt,
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
        parsed.score_grammar ??
        parsed.grammar_score ??
        parsed.grammar ??
        null,
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

      Strengths: Array.isArray(parsed.strengths)
        ? parsed.strengths.join("; ")
        : parsed.strengths || "",

      Weaknesses: Array.isArray(parsed.weaknesses)
        ? parsed.weaknesses.join("; ")
        : parsed.weaknesses || "",

      Recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.join("; ")
        : parsed.recommendations || "",

      RawTranscript:
        parsed.raw_transcript || body.transcript || body.rawText || "",

      LanguagePair: parsed.language_pair || "EN-??",
    };

    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
        AIRTABLE_REPORT_TABLE
      )}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records: [{ fields }],
        }),
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

