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
      null;

    if (!parsed) {
      return NextResponse.json(
        { success: false, error: "Missing evaluation payload", reason: "invalid_compat_payload" },
        { status: 400 },
      );
    }

    const asArray = (value: unknown) => (Array.isArray(value) ? value : []);
    const asText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    const cefr = asText((parsed as any).cefr_level);
    const transcript = Array.isArray(body?.transcript) ? body.transcript : [];

    let airtableId: string | null = null;
    let saveError: string | null = null;
    try {
      airtableId = await saveLumaReport({
        email: candidateEmail,
        emailKeyNormalized: candidateEmail.toLowerCase(),
        cefrLevel: cefr || undefined,
        accent: asText((parsed as any).accent) || undefined,
        strengths: asArray((parsed as any).strengths),
        weaknesses: asArray((parsed as any).weaknesses),
        recommendations: asArray((parsed as any).recommendations),
        overallComment: asText((parsed as any).overall_comment) || undefined,
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
    } catch (error: any) {
      saveError = String(error?.message ?? "Airtable save failed");
      console.error("[api/report] report generated but Airtable save failed", { error, message: saveError });
    }

    return NextResponse.json({
      success: true,
      airtableId,
      saveError,
      reportText:
        typeof body?.rawEvaluationText === "string"
          ? body.rawEvaluationText
          : typeof body?.rawText === "string"
            ? body.rawText
            : "",
      meta: {
        cefrLevel: cefr || null,
      },
      compatibilityMode: true,
    }, {
      status: saveError ? 207 : 200,
    });
  } catch (err) {
    console.error("Error handling /api/report request", err);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
