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

export default function ReportDetailPage({
  params,
}: {
  params: { reportId: string };
}) {
  const [report, setReport] = useState<ReportResponse["report"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const latestReportIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const rid = String(params.reportId || "").trim();

    if (!rid || rid === "undefined" || rid === "null") {
      setReport(null);
      setError("Invalid report id");
      setStatus("error");
      return () => {
        isMounted = false;
        controller.abort();
      };
    }

    latestReportIdRef.current = rid;

    const fetchReport = async () => {
      setStatus("loading");
      setError(null);
      try {
        const response = await fetch(
          `/api/admin/reports/${encodeURIComponent(rid)}`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as ReportResponse;
        if (!isMounted) {
          return;
        }
        if (latestReportIdRef.current !== rid) {
          return;
        }
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
          latestReportIdRef.current === rid
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
              <p className="text-xs font-semibold uppercase text-slate-400">Fields</p>
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
