"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

type ReportResponse = {
  ok: boolean;
  report?: {
    id: string;
    fields: Record<string, unknown>;
    createdTime?: string;
  };
  error?: string;
};

function toText(v: unknown) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  // Airtable può dare array / oggetti
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function splitLines(s: string) {
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-3 sm:items-center">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="sm:col-span-2 text-sm text-slate-900 break-words">
        {value || "—"}
      </div>
    </div>
  );
}

function SectionBox({
  title,
  items,
}: {
  title: string;
  items: string[] | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {items && items.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
          {items.map((it, idx) => (
            <li key={idx}>{it}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">—</p>
      )}
    </div>
  );
}

export default function ReportDetailPage() {
  const params = useParams<{ reportId?: string }>() ?? {};
  const [report, setReport] = useState<ReportResponse["report"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const latestReportIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const reportId = String(params.reportId ?? "").trim();
    latestReportIdRef.current = reportId;

    if (!reportId) {
      setError("Report not found");
      setStatus("error");
      return () => {
        isMounted = false;
        controller.abort();
      };
    }

    const fetchReport = async () => {
      setStatus("loading");
      setError(null);
      try {
        const response = await fetch(`/api/admin/reports/${reportId}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        const data = (await response.json()) as ReportResponse;

        if (!isMounted) return;
        if (latestReportIdRef.current !== reportId) return;

        if (!data.ok) {
          setError(data.error ?? "Unable to load report");
          setStatus("error");
          return;
        }

        if (!data.report) {
          setError("Report not found");
          setStatus("error");
          setReport(null);
          return;
        }

        setReport(data.report);
        setStatus("ready");
      } catch (err) {
        if (
          isMounted &&
          !controller.signal.aborted &&
          latestReportIdRef.current === reportId
        ) {
          setError("Unable to load report");
          setStatus("error");
        }
      }
    };

    fetchReport();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [params.reportId]);

  const fields = report?.fields ?? {};

  const candidateEmail = toText(fields["CandidateEmail"]);
  const cefr = toText(fields["CEFR_Level"]);
  const accent = toText(fields["Accent"]);
  const createdAt =
    toText(fields["CreatedAt"]) || report?.createdTime || undefined;

  const strengths = useMemo(() => {
    const raw = toText(fields["Strengths"]);
    return raw ? splitLines(raw) : [];
  }, [fields]);

  const weaknesses = useMemo(() => {
    const raw = toText(fields["Weaknesses"]);
    return raw ? splitLines(raw) : [];
  }, [fields]);

  const recommendations = useMemo(() => {
    const raw = toText(fields["Recommendations"]);
    return raw ? splitLines(raw) : [];
  }, [fields]);

  const overallComment = toText(fields["OverallComment"]);
  const reportIdValue = toText(fields["ReportID"]) || params.reportId || "";

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Report Detail</h1>
          <p className="mt-1 text-sm text-slate-500">
            Report ID: <span className="font-mono text-slate-700">{reportIdValue}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/reports"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to reports
          </Link>
        </div>
      </div>

      {status === "error" && error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {status === "loading" ? (
          <div className="space-y-3">
            <div className="h-4 w-40 rounded bg-slate-100" />
            <div className="h-4 w-72 rounded bg-slate-100" />
            <div className="h-24 w-full rounded bg-slate-100" />
          </div>
        ) : null}

        {status === "ready" && report ? (
          <div className="space-y-6">
            {/* SUMMARY */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldRow label="Candidate Email" value={candidateEmail} />
              <FieldRow label="Created At" value={formatDate(createdAt)} />
              <FieldRow label="CEFR Level" value={cefr} />
              <FieldRow label="Accent" value={accent} />
            </div>

            {/* SECTIONS */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <SectionBox title="Strengths" items={strengths} />
              <SectionBox title="Weaknesses" items={weaknesses} />
              <SectionBox title="Recommendations" items={recommendations} />
            </div>

            {/* OVERALL COMMENT */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Overall Comment
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                {overallComment || "—"}
              </p>
            </div>

            {/* RAW (collapsible style) */}
            <details className="rounded-xl border border-slate-200 bg-white p-5">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                Raw fields (debug)
              </summary>
              <pre className="mt-3 overflow-x-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
                {JSON.stringify(report.fields, null, 2)}
              </pre>
            </details>
          </div>
        ) : null}
      </div>
    </section>
  );
}
