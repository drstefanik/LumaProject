"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { adminTokens } from "@/lib/ui/tokens";

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
    <div className="grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-white/5 p-6 sm:grid-cols-3 sm:items-center">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="sm:col-span-2 text-sm text-slate-200 break-words">
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {items && items.length ? (
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-200">
            {items.map((it, idx) => (
              <li key={idx}>{it}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">—</p>
        )}
      </div>
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
    <section className="mx-auto w-full max-w-5xl space-y-8 lg:space-y-10">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">
            LUMA ADMIN
          </span>
          <h1 className="text-2xl font-semibold text-white">Admin / Report Detail</h1>
          <p className="text-sm text-slate-400">
            Report ID: <span className="font-mono text-slate-200">{reportIdValue}</span>
          </p>
        </div>

        <Link href="/admin/reports" className={adminTokens.buttonSecondary}>
          Back to reports
        </Link>
      </div>

      {status === "error" && error ? (
        <div className={adminTokens.errorNotice}>{error}</div>
      ) : null}

      {status === "loading" ? (
        <div className="space-y-3">
          <div className="h-4 w-40 rounded bg-white/10" />
          <div className="h-4 w-72 rounded bg-white/10" />
          <div className="h-24 w-full rounded bg-white/10" />
        </div>
      ) : null}

      {status === "ready" && report ? (
        <div className="space-y-8 lg:space-y-10">
          {/* SUMMARY */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-8">
            <FieldRow label="Candidate Email" value={candidateEmail} />
            <FieldRow label="Created At" value={formatDate(createdAt)} />
            <FieldRow label="CEFR Level" value={cefr} />
            <FieldRow label="Accent" value={accent} />
          </div>

          {/* SECTIONS */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
            <SectionBox title="Strengths" items={strengths} />
            <SectionBox title="Weaknesses" items={weaknesses} />
            <SectionBox title="Recommendations" items={recommendations} />
          </div>

          {/* OVERALL COMMENT */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Overall Comment</h3>
              <p className="whitespace-pre-wrap text-sm text-slate-200">
                {overallComment || "—"}
              </p>
            </div>
          </div>

          {/* RAW (collapsible style) */}
          <details className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <summary className="cursor-pointer text-sm font-semibold text-white">
              Raw fields (debug)
            </summary>
            <pre className="mt-3 overflow-x-auto rounded-md bg-slate-900 p-4 text-xs text-slate-200">
              {JSON.stringify(report.fields, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </section>
  );
}
