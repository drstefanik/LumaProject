import { NextRequest, NextResponse } from "next/server";

import { saveLumaReport } from "@/lib/airtable";
import { generateCanonicalSpeakingReport } from "@/lib/report/generateCanonicalSpeakingReport";

function validatePayload(body: any) {
  if (typeof body?.sessionId !== "string") return false;
  const sessionId = body.sessionId.trim();
  return sessionId.length > 0 && sessionId.toLowerCase() !== "null";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (validatePayload(body)) {
      const result = await generateCanonicalSpeakingReport(String(body.sessionId));
      return NextResponse.json(result.payload, { status: result.status });
    }

    const candidateEmail = typeof body?.candidateEmail === "string" ? body.candidateEmail.trim() : "";
    if (!candidateEmail) {
      return NextResponse.json(
        { success: false, error: "Missing sessionId and candidateEmail", reason: "invalid_compat_payload" },
        { status: 400 },
      );
    }

    const parsed =
      (typeof body?.evaluation === "object" && body.evaluation) ||
      (typeof body?.finalReport === "object" && body.finalReport) ||
      (typeof body?.parsed === "object" && body.parsed) ||
      {};
    const asArray = (value: unknown) => Array.isArray(value) && value.length > 0 ? value : ["insufficient_evidence"];
    const asText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : "insufficient_evidence";
    const cefr = typeof parsed.cefr_level === "string" && parsed.cefr_level.trim() ? parsed.cefr_level.trim() : "insufficient_evidence";
    const transcript = Array.isArray(body?.transcript) ? body.transcript : [];

    const airtableId = await saveLumaReport({
      email: candidateEmail,
      emailKeyNormalized: candidateEmail.toLowerCase(),
      cefrLevel: cefr,
      accent: asText(parsed.accent),
      strengths: asArray(parsed.strengths),
      weaknesses: asArray(parsed.weaknesses),
      recommendations: asArray(parsed.recommendations),
      overallComment: asText(parsed.overall_comment),
      reportStatus: "generated",
      reportVersion: "v1-compat",
      reportSource: "legacy_api_candidate_email",
      transcriptIntegrity: transcript.length > 0 ? "ok" : "insufficient_evidence",
      rawJson:
        (typeof body?.rawEvaluationText === "string" && body.rawEvaluationText.trim() && body.rawEvaluationText) ||
        (typeof body?.rawText === "string" && body.rawText.trim() && body.rawText) ||
        JSON.stringify(parsed),
      finalizedTranscriptJson: JSON.stringify({ transcript }),
    });

    return NextResponse.json({
      success: true,
      airtableId,
      reportText:
        typeof body?.rawEvaluationText === "string"
          ? body.rawEvaluationText
          : typeof body?.rawText === "string"
            ? body.rawText
            : "",
      meta: {
        cefrLevel: cefr,
      },
      compatibilityMode: true,
    });
  } catch (err) {
    console.error("Error handling /api/report request", err);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
