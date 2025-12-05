import { NextRequest, NextResponse } from "next/server";
import { reportsTable } from "@/lib/airtable";
import type { LumaSpeakingReport } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as LumaSpeakingReport;

    if (payload.type !== "luma_speaking_report") {
      return NextResponse.json(
        { error: "Invalid report type" },
        { status: 400 }
      );
    }

    const {
      accent_label,
      accent_detail,
      language_pair,
      cefr_global,
      scores,
      strengths,
      weaknesses,
      recommendations,
      transcript_summary,
      meta
    } = payload;

    if (!process.env.AIRTABLE_API_KEY) {
      console.warn(
        "[LUMA] Airtable not configured, skipping report persistence."
      );
      return NextResponse.json({ ok: true, skipped: true });
    }

    const table = reportsTable();

    const [record] = await table.create([
      {
        fields: {
          AccentDetected: accent_label,
          AccentDetail: accent_detail,
          LanguagePair: language_pair,
          CEFR_Global: cefr_global,
          Score_Fluency: scores?.fluency,
          Score_Pronunciation: scores?.pronunciation,
          Score_Grammar: scores?.grammar,
          Score_Vocabulary: scores?.vocabulary,
          Score_Coherence: scores?.coherence,
          Strengths: strengths,
          Weaknesses: weaknesses,
          Recommendations: recommendations,
          RawTranscript: transcript_summary,
          CandidateId: meta?.candidateId,
          Name: meta?.candidateName,
          DateTime: new Date().toISOString(),
          SessionId: meta?.sessionId
        }
      }
    ]);

    return NextResponse.json({ ok: true, id: record.getId() });
  } catch (err) {
    console.error("Error saving report", err);
    return NextResponse.json(
      { error: "Failed to save report" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    if (!process.env.AIRTABLE_API_KEY) {
      return NextResponse.json({ reports: [] }, { status: 200 });
    }

    const table = reportsTable();
    const records = await table
      .select({
        maxRecords: 100,
        sort: [{ field: "DateTime", direction: "desc" }]
      })
      .all();

    const reports = records.map((rec) => ({
      id: rec.getId(),
      ...(rec.fields as any)
    }));

    return NextResponse.json({ reports });
  } catch (err) {
    console.error("Error loading reports", err);
    return NextResponse.json(
      { error: "Failed to load reports" },
      { status: 500 }
    );
  }
}
