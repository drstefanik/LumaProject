"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type ReportResponse = {
  ok: boolean;
  report?: {
    id: string;
    fields: Record<string, unknown>;
    createdTime?: string;
  };
  error?: string;
};

type DebugState = {
  url: string;
  httpStatus: number | null;
  contentType: string | null;
  rawBodyPreview: string | null;
};

export default function ReportDetailPage({
  params,
}: {
  params: { reportId: string };
}) {
  const [report, setReport] = useState<ReportResponse["report"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const latestReportIdRef = useRef<string | null>(null);

  const [debug, setDebug] = useState<DebugState>({
    url: "",
    httpStatus: null,
    contentType: null,
    rawBodyPreview: null,
  });

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
      setReport(null);

      const url = `/api/admin/reports/${encodeURIComponent(reportId)}`;
      setDebug((d) => ({ ...d, url, httpStatus: null, contentType: null, rawBodyPreview: null }));

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        const contentType = response.headers.get("content-type");
        const rawText = await response.text();

        if (!isMounted) return;
        if (latestReportIdRef.current !== reportId) return;

        setDebug({
          url,
          httpStatus: response.status,
          contentType,
          rawBodyPreview: rawText.slice(0, 400),
        });

        // Se NON è 2xx, non proviamo nemmeno a parsare “a fiducia”
        if (!response.ok) {
          setError(`Unable to load report (HTTP ${response.status})`);
          setStatus("error");
          return;
        }

        // Proviamo a parsare JSON
        let data: ReportResponse | null = null;
        try {
          data = JSON.parse(rawText) as ReportResponse;
        } catch {
          setError("Unable to load report (non-JSON response)");
          setStatus("error");
          return;
        }

        if (!data.ok) {
          setError(data.error ?? "Report not found");
          setStatus("error");
          return;
        }

        if (!data.report) {
          setError("Report not found");
          setStatus("error");
          return;
        }

        setReport(data.report);
        setStatus("ready");
      } catch {
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

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Report Detail</h1>
          <p className="text-sm text-slate-500">Report ID: {params.reportId}</p>
        </div>

        <Link
          href="/admin/reports"
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Back to reports
        </Link>
      </div>

      {/* DEBUG BOX (temporaneo ma fondamentale) */}
      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
        <div><span className="font-semibold">Debug URL:</span> {debug.url || "-"}</div>
        <div><span className="font-semibold">HTTP:</span> {debug.httpStatus ?? "-"}</div>
        <div><span className="font-semibold">Content-Type:</span> {debug.contentType ?? "-"}</div>
        <div className="mt-2">
          <div className="font-semibold">Body preview:</div>
          <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-900 p-2 text-[11px] text-slate-100">
            {debug.rawBodyPreview ?? "-"}
          </pre>
        </div>
      </div>

      {status === "error" && error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {status === "loading" ? (
          <p className="text-sm text-slate-500">Loading report details...</p>
        ) : null}

        {status === "ready" && report ? (
          <div className="space-y-4 text-sm text-slate-700">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Fields
              </p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
                {JSON.stringify(report.fields, null, 2)}
              </pre>
            </div>
            <div className="text-xs text-slate-400">
              Created: {report.createdTime ?? "Unknown"}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
