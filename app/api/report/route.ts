import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

import { saveLumaReport } from "@/lib/airtable";
import { openai } from "@/lib/openai";

const REPORT_MODEL = process.env.OPENAI_REPORT_MODEL || "gpt-4.1-mini";

type CandidatePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  dateOfBirth?: string;
  nativeLanguage?: string;
  country?: string;
  testPurpose?: string;
  consentPrivacy?: boolean;
};

type EvaluationPayload = {
  rawJson?: string;
  parsed?: {
    candidate_name?: string;
    cefr_level?: string;
    accent?: string;
    strengths?: string[];
    weaknesses?: string[];
    recommendations?: string[];
    overall_comment?: string;
    global_score?: number;
  };
};

function validatePayload(body: any) {
  const { candidate, evaluation } = body || {};

  if (!candidate || typeof candidate !== "object") return false;
  if (!candidate.firstName || !candidate.lastName || !candidate.email)
    return false;

  if (!evaluation || typeof evaluation !== "object") return false;

  const hasRaw =
    typeof evaluation.rawJson === "string" &&
    evaluation.rawJson.trim().length > 0;

  const hasParsed = evaluation.parsed && typeof evaluation.parsed === "object";

  // Basta che ci sia raw JSON O parsed JSON
  if (!hasRaw && !hasParsed) return false;

  return true;
}

function stringifyEvaluation(evaluation: EvaluationPayload) {
  if (typeof evaluation.rawJson === "string" && evaluation.rawJson.trim()) {
    return evaluation.rawJson;
  }

  if (evaluation.parsed) {
    return JSON.stringify(evaluation.parsed, null, 2);
  }

  return "{}";
}

async function generateReport(
  candidate: CandidatePayload,
  evaluation: EvaluationPayload
) {
  const systemPrompt =
    "You are an experienced English speaking examiner. Write concise, well-structured reports for speaking tests. " +
    "Keep the tone professional but accessible.";

  const userPrompt = [
    "Please write a speaking test report based on the following evaluation data.",
    "The report must be structured with the following sections:",
    "1. Candidate Overview",
    "2. Pronunciation",
    "3. Fluency & Confidence",
    "4. Vocabulary & Range",
    "5. Grammar & Coherence",
    "6. Overall CEFR Level",
    "7. Recommendations",
    "",
    "Refer to the candidate in the third person.",
    "",
    "Candidate data:",
    JSON.stringify(
      {
        name: `${candidate.firstName ?? ""} ${candidate.lastName ?? ""}`.trim(),
        country: candidate.country,
        nativeLanguage: candidate.nativeLanguage,
        testPurpose: candidate.testPurpose,
        cefrLevel: evaluation.parsed?.cefr_level,
      },
      null,
      2
    ),
    "",
    "Evaluation JSON:",
    stringifyEvaluation(evaluation),
  ].join("\n");

  const completion = await openai.responses.create({
    model: REPORT_MODEL,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const reportText = completion.output_text?.trim();

  if (!reportText) {
    throw new Error("No report text returned from OpenAI");
  }

  return reportText;
}

async function saveReportLocally(
  candidate: CandidatePayload,
  evaluation: EvaluationPayload,
  reportText: string
) {
  const dir = path.join(process.cwd(), "report");
  await fs.mkdir(dir, { recursive: true });

  const baseName = (candidate.email || "report").replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );
  let filePath = path.join(dir, `${baseName}.json`);
  let counter = 2;

  while (true) {
    try {
      await fs.access(filePath);
      filePath = path.join(dir, `${baseName}_${counter}.json`);
      counter += 1;
    } catch {
      break;
    }
  }

  const payload = {
    candidate,
    evaluation,
    reportText,
    createdAt: new Date().toISOString(),
  };

  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[/api/report] Incoming payload", body);

    if (!validatePayload(body)) {
      console.error("[/api/report] Invalid payload");
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const candidate = body.candidate as CandidatePayload;
    const evaluation = body.evaluation as EvaluationPayload;

    // normalizziamo: se il frontend non ha parsed, ci proviamo qui dal rawJson
    let normalizedParsed = evaluation.parsed;
    if (!normalizedParsed && typeof evaluation.rawJson === "string") {
      try {
        normalizedParsed = JSON.parse(evaluation.rawJson);
        console.log(
          "[/api/report] Parsed evaluation.rawJson on server side successfully"
        );
      } catch (e) {
        console.warn(
          "[/api/report] Failed to parse evaluation.rawJson on server",
          e
        );
      }
    }

    const normalizedEvaluation: EvaluationPayload = {
      rawJson: evaluation.rawJson,
      parsed: normalizedParsed,
    };

    let reportText: string;

    try {
      reportText = await generateReport(candidate, normalizedEvaluation);
    } catch (error) {
      console.error("[/api/report] Error generating report", error);
      return NextResponse.json(
        { error: "Failed to generate report" },
        { status: 500 }
      );
    }

    let airtableId: string | null = null;
    let localReportPath: string | null = null;

    try {
      const airtablePayload = {
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email!,
        cefrLevel: normalizedEvaluation.parsed?.cefr_level,
        accent: normalizedEvaluation.parsed?.accent,
        strengths: normalizedEvaluation.parsed?.strengths,
        weaknesses: normalizedEvaluation.parsed?.weaknesses,
        recommendations: normalizedEvaluation.parsed?.recommendations,
        overallComment: normalizedEvaluation.parsed?.overall_comment,
        rawJson: stringifyEvaluation(normalizedEvaluation),
      };

      console.log("[Airtable] LUMA report fields", airtablePayload);

      airtableId = await saveLumaReport(airtablePayload);
    } catch (error) {
      console.error(
        "[/api/report] Error saving LUMA report to Airtable",
        JSON.stringify(error, null, 2)
      );
      airtableId = null;
    }

    try {
      localReportPath = await saveReportLocally(
        candidate,
        normalizedEvaluation,
        reportText
      );
    } catch (error) {
      // in produzione (Vercel) può fallire, non è grave
      console.warn("[/api/report] Unable to save local report file", error);
      localReportPath = null;
    }

    console.log(
      "[/api/report] Report generated and saved. airtableId =",
      airtableId
    );

    return NextResponse.json({
      success: true,
      airtableId,
      localReportPath,
      reportText,
      meta: {
        cefrLevel: normalizedEvaluation.parsed?.cefr_level ?? null,
        globalScore: normalizedEvaluation.parsed?.global_score ?? null,
      },
    });
  } catch (err) {
    console.error("Error handling /api/report request", err);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
