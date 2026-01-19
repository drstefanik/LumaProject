"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type ReportListItem = {
  recordId: string;
  reportId: string | null;
  candidateEmail: string | null;
  cefrLevel: string | null;
  accent: string | null;
  createdAt: string | null;
  pdfUrl: string | null;
  pdfStatus: string | null;
  pdfGeneratedAt: string | null;
  examDate: string | null;
};

type ReportsResponse = {
  ok: boolean;
  items: ReportListItem[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
};

const pageSize = 20;

export default function AdminReportsPage() {
  const [items, setItems] = useState<ReportListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [cefr, setCefr] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / pageSize));
  }, [total]);

  const fetchReports = useCallback(
    async ({
      signal,
      preserveActionMessage = false,
    }: {
      signal: AbortSignal;
      preserveActionMessage?: boolean;
    }) => {
      setLoading(true);
      setError(null);
      if (!preserveActionMessage) {
        setActionMessage(null);
      }

      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("q", search.trim());
        if (cefr) params.set("cefr", cefr);
        if (status) params.set("status", status);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const response = await fetch(`/api/admin/reports?${params.toString()}`, {
          signal,
        });
        const data = (await response.json()) as ReportsResponse;

        if (signal.aborted) return;

        if (!data.ok) {
          setError(data.error ?? "Unable to load reports");
          return;
        }

        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      } catch (err) {
        if (!signal.aborted) setError("Unable to load reports");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [search, cefr, status, page],
  );

  useEffect(() => {
    const controller = new AbortController();

    fetchReports({ signal: controller.signal });

    return () => {
      controller.abort();
    };
  }, [fetchReports]);

  // NOTE: expects an Airtable recordId (recXXXXXXXXXXXXXXX)
  const handleGeneratePdf = async (recordId: string) => {
    setActionMessage(null);

    try {
      const response = await fetch(
        `/api/admin/reports/${encodeURIComponent(recordId)}/pdf`,
        { method: "POST" },
      );

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/pdf")) {
        const pdfBlob = await response.blob();
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, "_blank", "noopener,noreferrer");
        setActionMessage("PDF generated. Opening preview.");
        return;
      }

      const data = await response.json();

      if (data.ok) {
        setActionMessage("PDF generated successfully.");

        if (data.pdfUrl) {
          setItems((prev) =>
            prev.map((item) =>
              item.recordId === recordId
                ? {
                    ...item,
                    pdfUrl: data.pdfUrl,
                    pdfStatus: data.pdfStatus ?? item.pdfStatus,
                    pdfGeneratedAt: data.pdfGeneratedAt ?? item.pdfGeneratedAt,
                  }
                : item,
            ),
          );
        }

        const controller = new AbortController();
        await fetchReports({
          signal: controller.signal,
          preserveActionMessage: true,
        });
      } else {
        setActionMessage(data.error ?? "PDF generation not available.");
      }
    } catch (err) {
      setActionMessage("PDF generation not available.");
    }
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">
          Review candidate reports and manage PDF exports.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-1 flex-col gap-3 md:flex-row">
          <label className="flex w-full flex-col text-sm font-medium text-slate-700">
            Search by email or Report ID
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="mt-1 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
              placeholder="john@example.com or RPT-123"
            />
          </label>

          <label className="flex flex-col text-sm font-medium text-slate-700">
            CEFR
            <select
              value={cefr}
              onChange={(event) => {
                setCefr(event.target.value);
                setPage(1);
              }}
              className="mt-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All levels</option>
              <option value="A1">A1</option>
              <option value="A2">A2</option>
              <option value="B1">B1</option>
              <option value="B2">B2</option>
              <option value="C1">C1</option>
              <option value="C2">C2</option>
            </select>
          </label>

          <label className="flex flex-col text-sm font-medium text-slate-700">
            PDF status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="mt-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="draft">draft</option>
              <option value="final">final</option>
              <option value="pending">pending</option>
            </select>
          </label>
        </div>

        <div className="text-sm text-slate-500">
          {loading ? "Loading reports..." : `${total} total reports`}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {actionMessage ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {actionMessage}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Report ID</th>
              <th className="px-4 py-3">Candidate Email</th>
              <th className="px-4 py-3">CEFR Level</th>
              <th className="px-4 py-3">Accent</th>
              <th className="px-4 py-3">Created At</th>
              <th className="px-4 py-3">PDF Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  No reports found.
                </td>
              </tr>
            ) : null}

            {items.map((item) => {
              const reportId = item.reportId?.trim() ?? "";
              const recordId = item.recordId?.trim() ?? "";
              const canView = Boolean(recordId);

              return (
                <tr key={item.recordId} className="text-slate-700">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {reportId || recordId || "—"}
                  </td>
                  <td className="px-4 py-3">{item.candidateEmail ?? "—"}</td>
                  <td className="px-4 py-3">{item.cefrLevel ?? "—"}</td>
                  <td className="px-4 py-3">{item.accent ?? "—"}</td>
                  <td className="px-4 py-3">
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">{item.pdfStatus ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        prefetch={false}
                        href={
                          `/admin/reports/${encodeURIComponent(recordId)}` as any
                        }
                        aria-disabled={!canView}
                        className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                          canView
                            ? "border-slate-200 text-slate-700 hover:bg-slate-50"
                            : "cursor-not-allowed border-slate-200 text-slate-400 pointer-events-none"
                        }`}
                      >
                        View
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleGeneratePdf(recordId)}
                        disabled={!canView}
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Generate PDF
                      </button>

                      {item.pdfUrl ? (
                        <a
                          href={item.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="cursor-not-allowed rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-400">
                          Download
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
