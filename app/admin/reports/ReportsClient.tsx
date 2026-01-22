"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/* =======================
   Types
======================= */

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
  error?: unknown;
};

const PAGE_SIZE = 20;
const DEFAULT_SORT = "createdAt";
const DEFAULT_DIR = "desc";

const SORTABLE_COLUMNS = {
  candidateEmail: "Candidate Email",
  cefrLevel: "CEFR Level",
  accent: "Accent",
  createdAt: "Created At",
  pdfStatus: "PDF Status",
} as const;

type SortKey = keyof typeof SORTABLE_COLUMNS;
type SortDir = "asc" | "desc";

/* =======================
   Helpers
======================= */

// Garantisce che in UI finisca SEMPRE una stringa
function asMessage(value: unknown, fallback: string) {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

/* =======================
   Page
======================= */

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const safeSearchParams = searchParams ?? new URLSearchParams();
  const [items, setItems] = useState<ReportListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState("");
  const [cefr, setCefr] = useState("");
  const [status, setStatus] = useState("");

  const getSortKey = useCallback(
    (value: string | null) => {
      if (value && value in SORTABLE_COLUMNS) {
        return value as SortKey;
      }
      return DEFAULT_SORT as SortKey;
    },
    [],
  );

  const getSortDir = useCallback((value: string | null) => {
    return value === "asc" || value === "desc" ? value : DEFAULT_DIR;
  }, []);

  const [sortKey, setSortKey] = useState<SortKey>(() =>
    getSortKey(safeSearchParams.get("sort")),
  );
  const [sortDir, setSortDir] = useState<SortDir>(() =>
    getSortDir(safeSearchParams.get("dir")),
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [total]);

  useEffect(() => {
    const nextKey = getSortKey(safeSearchParams.get("sort"));
    const nextDir = getSortDir(safeSearchParams.get("dir"));
    setSortKey(nextKey);
    setSortDir(nextDir);
  }, [getSortDir, getSortKey, safeSearchParams]);

  useEffect(() => {
    const currentSort = safeSearchParams.get("sort");
    const currentDir = safeSearchParams.get("dir");
    const sanitizedSort = getSortKey(currentSort);
    const sanitizedDir = getSortDir(currentDir);

    if (sanitizedSort === currentSort && sanitizedDir === currentDir) {
      return;
    }

    const params = new URLSearchParams(safeSearchParams);
    params.set("sort", sanitizedSort);
    params.set("dir", sanitizedDir);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [getSortDir, getSortKey, router, safeSearchParams]);

  /* =======================
     Fetch reports
  ======================= */

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
      if (!preserveActionMessage) setActionMessage(null);

      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("q", search.trim());
        if (cefr) params.set("cefr", cefr);
        if (status) params.set("status", status);
        params.set("sort", sortKey);
        params.set("dir", sortDir);
        params.set("page", String(page));
        params.set("pageSize", String(PAGE_SIZE));

        const response = await fetch(`/api/admin/reports?${params.toString()}`, { signal });
        const data = (await response.json()) as ReportsResponse;

        if (signal.aborted) return;

        if (!response.ok || !data.ok) {
          setError(asMessage(data?.error, "Unable to load reports"));
          return;
        }

        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(typeof data.total === "number" ? data.total : 0);
      } catch (err) {
        if (!signal.aborted) setError(asMessage(err, "Unable to load reports"));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [search, cefr, status, page, sortKey, sortDir],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchReports({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchReports]);

  const handleSort = (key: SortKey) => {
    const nextDir = key === sortKey ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    setSortKey(key);
    setSortDir(nextDir);
    setPage(1);

    const params = new URLSearchParams(safeSearchParams);
    params.set("sort", key);
    params.set("dir", nextDir);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const renderSortIcon = (active: boolean, dir: SortDir) => {
    if (!active) return null;

    const rotationClass = dir === "asc" ? "rotate-180" : "";

    return (
      <svg
        className={`h-3 w-3 text-slate-400 transition-transform ${rotationClass}`}
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          d="M10 14l-4-4h8l-4 4z"
          fill="currentColor"
        />
      </svg>
    );
  };

  /* =======================
     Generate PDF
  ======================= */

  const handleGeneratePdf = async (recordIdRaw: string) => {
    const recordId = String(recordIdRaw || "").trim();
    if (!recordId) {
      setActionMessage("PDF generation not available.");
      return;
    }

    setActionMessage(null);

    try {
      const response = await fetch(`/api/admin/reports/${encodeURIComponent(recordId)}/pdf`, {
        method: "POST",
      });

      const contentType = response.headers.get("content-type") ?? "";

      // Inline PDF fallback
      if (contentType.includes("application/pdf")) {
        const pdfBlob = await response.blob();
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, "_blank", "noopener,noreferrer");
        setActionMessage("PDF generated. Opening preview.");
        return;
      }

      const data: any = await response.json().catch(() => null);

      if (!response.ok) {
        setActionMessage(asMessage(data?.error, "Failed to generate PDF"));
        return;
      }

      if (data?.ok) {
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
        await fetchReports({ signal: controller.signal, preserveActionMessage: true });
      } else {
        setActionMessage(asMessage(data?.error, "PDF generation not available."));
      }
    } catch (err) {
      setActionMessage(asMessage(err, "PDF generation not available."));
    }
  };

  /* =======================
     Render
  ======================= */

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">Review candidate reports and manage PDF exports.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-1 flex-col gap-3 md:flex-row">
          <label className="flex w-full flex-col text-sm font-medium text-slate-700">
            Search by email or Report ID
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="mt-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="john@example.com or RPT-123"
            />
          </label>

          <label className="flex flex-col text-sm font-medium text-slate-700">
            CEFR
            <select
              value={cefr}
              onChange={(e) => {
                setCefr(e.target.value);
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
              onChange={(e) => {
                setStatus(e.target.value);
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
              {(Object.keys(SORTABLE_COLUMNS) as SortKey[]).map((key) => {
                const isActive = sortKey === key;
                return (
                  <th
                    key={key}
                    className="px-4 py-3"
                    aria-sort={isActive ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(key)}
                      className={`group inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 ${
                        isActive ? "text-slate-700" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <span>{SORTABLE_COLUMNS[key]}</span>
                      {renderSortIcon(isActive, sortDir)}
                    </button>
                  </th>
                );
              })}
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
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">{item.pdfStatus ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {canView ? (
                        <a
                          href={`/admin/reports/${encodeURIComponent(recordId)}`}
                          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          View
                        </a>
                      ) : (
                        <span className="cursor-not-allowed rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-400">
                          View
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleGeneratePdf(recordId)}
                        disabled={!canView}
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Generate PDF
                      </button>

                      {item.pdfUrl ? (
                        <a
                          href={item.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
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
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
