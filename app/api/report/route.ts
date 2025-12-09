import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_REPORTS =
  process.env.AIRTABLE_TABLE_REPORTS || process.env.AIRTABLE_REPORT_TABLE || "LUMA-Reports";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL;
const OPENAI_PROJECT_ID = process.env.OPENAI_PROJECT_ID;

const openai = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY, project: OPENAI_PROJECT_ID })
  : null;

const REQUIRED_FIELDS = [
  "candidate_name",
  "cefr_level",
  "accent",
  "strengths",
  "weaknesses",
  "recommendations",
  "overall_comment",
];

type StructuredReport = {
  candidate_name: string | null;
  cefr_level: string;
  accent: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  overall_comment: string;
};

async function buildStructuredReport(rawText?: string, rawJson?: any) {
  if (rawJson) return rawJson as StructuredReport;

  if (!openai || !OPENAI_TEXT_MODEL) {
    throw new Error("OpenAI text model is not configured");
  }

  const prompt = [
    "You are LUMA, an English speaking examiner. Parse the following evaluation text and return ONLY a JSON object with these fields:",
    "- candidate_name (string or null)",
    "- cefr_level (string)",
    "- accent (string)",
    "- strengths (array of strings)",
    "- weaknesses (array of strings)",
    "- recommendations (array of strings)",
    "- overall_comment (string)",
    "", //
    "Respond with strict JSON and no markdown or prose.",
    `Evaluation text: ${rawText}`,
  ].join("\n");

  const completion = await openai.responses.create({
    model: OPENAI_TEXT_MODEL,
    input: [
      {
        role: "system",
        content: prompt,
      },
    ],
  });

  const messageContent = completion.output_text ?? "";
  return JSON.parse(messageContent || "{}");
}

function normalizeStructured(data: any): StructuredReport {
  const ensureArray = (value: any): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String);
    return String(value)
      .split(/[,\n;]/)
      .map((v) => v.trim())
      .filter(Boolean);
  };

  const normalized: StructuredReport = {
    candidate_name:
      data.candidate_name !== undefined ? data.candidate_name : data.name ?? null,
    cefr_level: data.cefr_level ?? data.level ?? "",
    accent: data.accent ?? data.accent_detected ?? "",
    strengths: ensureArray(data.strengths),
    weaknesses: ensureArray(data.weaknesses),
    recommendations: ensureArray(data.recommendations),
    overall_comment: data.overall_comment ?? data.comment ?? "",
  };

  const missing = REQUIRED_FIELDS.filter((key) => {
    const value = (normalized as any)[key];
    return value === undefined || value === null || value === "";
  });

  if (missing.length) {
    throw new Error(`Missing fields in structured report: ${missing.join(", ")}`);
  }

  return normalized;
}

async function saveToAirtable(
  candidateId: string,
  structured: StructuredReport,
  rawText?: string
) {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_REPORTS) {
    throw new Error("Airtable is not configured");
  }

  const fields: Record<string, any> = {
    Candidate: [candidateId],
    CandidateName: structured.candidate_name || undefined,
    CEFRLevel: structured.cefr_level,
    Accent: structured.accent,
    Strengths: structured.strengths.join("; "),
    Weaknesses: structured.weaknesses.join("; "),
    Recommendations: structured.recommendations.join("; "),
    OverallComment: structured.overall_comment,
    RawEvaluationText: rawText || null,
    StructuredJSON: JSON.stringify(structured),
  };

  const res = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
      AIRTABLE_TABLE_REPORTS
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
    throw new Error(`Airtable error: ${errText}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const candidateId = body.candidateId as string | undefined;
    const rawEvaluationText = body.rawEvaluationText as string | undefined;
    const rawEvaluationJson = body.rawEvaluationJson as any;

    if (!candidateId) {
      return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
    }

    if (!rawEvaluationText && !rawEvaluationJson) {
      return NextResponse.json(
        { error: "Provide rawEvaluationText or rawEvaluationJson" },
        { status: 400 }
      );
    }

    const structured = normalizeStructured(
      await buildStructuredReport(rawEvaluationText, rawEvaluationJson)
    );

    await saveToAirtable(candidateId, structured, rawEvaluationText);

    return NextResponse.json({ ok: true, report: structured });
  } catch (err: any) {
    console.error("Error handling report", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
