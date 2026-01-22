"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { adminTokens } from "@/lib/ui/tokens";

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
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [total]);

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
    [search, cefr, status, page],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchReports({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchReports]);

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
      <div className={`flex flex-col gap-4 md:flex-row md:items-end md:justify-between ${adminTokens.filterCard}`}>
        <div className="flex flex-1 flex-col gap-3 md:flex-row">
          <label className={`flex w-full flex-col ${adminTokens.label}`}>
            Search by email or Report ID
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className={adminTokens.input}
              placeholder="john@example.com or RPT-123"
            />
          </label>

          <label className={`flex flex-col ${adminTokens.label}`}>
            CEFR
            <select
              value={cefr}
              onChange={(e) => {
                setCefr(e.target.value);
                setPage(1);
              }}
              className={adminTokens.select}
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

          <label className={`flex flex-col ${adminTokens.label}`}>
            PDF status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className={adminTokens.select}
            >
              <option value="">All statuses</option>
              <option value="draft">draft</option>
              <option value="final">final</option>
              <option value="pending">pending</option>
            </select>
          </label>
        </div>

        <div className={`text-sm ${adminTokens.mutedText}`}>
          {loading ? "Loading reports..." : `${total} total reports`}
        </div>
      </div>

      {error ? (
        <div className={adminTokens.errorNotice}>{error}</div>
      ) : null}

      {actionMessage ? (
        <div className={adminTokens.notice}>{actionMessage}</div>
      ) : null}

      <div className={adminTokens.tableContainer}>
        <table className={`min-w-full text-sm ${adminTokens.tableDivider}`}>
          <thead className={`text-left ${adminTokens.tableHeader}`}>
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

          <tbody className={adminTokens.tableDivider}>
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className={`px-4 py-6 text-center ${adminTokens.mutedText}`}>
                  No reports found.
                </td>
              </tr>
            ) : null}

            {items.map((item) => {
              const reportId = item.reportId?.trim() ?? "";
              const recordId = item.recordId?.trim() ?? "";
              const canView = Boolean(recordId);
              const generateClass = item.pdfUrl
                ? adminTokens.buttonSecondary
                : adminTokens.buttonPrimary;

              return (
                <tr
                  key={item.recordId}
                  className={`${adminTokens.tableRow} ${adminTokens.tableRowHover}`}
                >
                  <td className="px-4 py-3 font-semibold text-white">
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
                    <div className="flex flex-col items-end gap-2">
                      {canView ? (
                        <a
                          href={`/admin/reports/${encodeURIComponent(recordId)}`}
                          className={adminTokens.buttonSecondary}
                        >
                          View
                        </a>
                      ) : (
                        <span className={adminTokens.buttonGhost}>
                          View
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleGeneratePdf(recordId)}
                        disabled={!canView}
                        className={generateClass}
                      >
                        Generate PDF
                      </button>

                      {item.pdfUrl ? (
                        <a
                          href={item.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={adminTokens.buttonPrimary}
                        >
                          Download
                        </a>
                      ) : (
                        <span className={adminTokens.buttonGhost}>
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

      <div className={`flex items-center justify-between text-sm ${adminTokens.mutedText}`}>
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className={adminTokens.buttonSecondary}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className={adminTokens.buttonSecondary}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
