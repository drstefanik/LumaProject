"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { AdminStack } from "@/components/admin/AdminStack";
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

function InfoCard({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 text-sm text-slate-200 md:text-base">{children}</div>
    </div>
  );
}

function SummaryCard({
  title,
  items,
}: {
  title: string;
  items: string[] | null;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/[0.07]">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {items && items.length ? (
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-200 md:text-base">
            {items.map((it, idx) => (
              <li key={idx}>{it}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-200 md:text-base">—</p>
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
    <section className="mx-auto w-full max-w-5xl">
      <AdminStack>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              LUMA ADMIN
            </span>
            <h1 className="text-3xl font-semibold text-white">Report Detail</h1>
            <p className="text-sm text-slate-400">
              Report ID: <span className="font-mono text-slate-200">{reportIdValue}</span>
            </p>
          </div>

          <Link
            href="/admin/reports"
            className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.07]"
          >
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
          <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 md:p-8">
            <div className="space-y-6 md:space-y-8">
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-white">Candidate</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                  <InfoCard label="Candidate Email">
                    <span className="break-words">{candidateEmail || "—"}</span>
                  </InfoCard>
                  <InfoCard label="Created at">{formatDate(createdAt)}</InfoCard>
                  <InfoCard label="CEFR level">
                    {cefr ? (
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                        {cefr}
                      </span>
                    ) : (
                      "—"
                    )}
                  </InfoCard>
                  <InfoCard label="Accent">
                    {accent ? (
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                        {accent}
                      </span>
                    ) : (
                      "—"
                    )}
                  </InfoCard>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-white">Performance Summary</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6 xl:gap-8">
                  <SummaryCard title="Strengths" items={strengths} />
                  <SummaryCard title="Weaknesses" items={weaknesses} />
                  <SummaryCard title="Recommendations" items={recommendations} />
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-white">Overall Comment</h2>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-7">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200 md:text-base">
                    {overallComment || "—"}
                  </p>
                </div>
              </div>

              <details className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 md:p-6 text-slate-400">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Raw fields (debug)
                </summary>
                <pre className="mt-4 overflow-x-auto rounded-md bg-slate-950/80 p-4 text-xs text-slate-200">
                  {JSON.stringify(report.fields, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        ) : null}
      </AdminStack>
    </section>
  );
}
