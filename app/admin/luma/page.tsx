"use client";

import { useEffect, useState } from "react";

import { adminTokens } from "@/lib/ui/tokens";

interface ReportRow {
  id: string;
  AccentDetected?: string;
  AccentDetail?: string;
  LanguagePair?: string;
  CEFR_Global?: string;
  Score_Fluency?: number;
  Score_Pronunciation?: number;
  Score_Grammar?: number;
  Score_Vocabulary?: number;
  Score_Coherence?: number;
  Strengths?: string;
  Weaknesses?: string;
  Recommendations?: string;
  RawTranscript?: string;
  Name?: string;
  DateTime?: string;
}

export default function AdminLumaPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReportRow | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/report");
        if (!res.ok) {
          throw new Error("Failed to load reports");
        }
        const data = await res.json();
        setReports(data.reports || []);
      } catch (err: any) {
        setError(err?.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main className="space-y-8 lg:space-y-10">
      <h1 className="text-2xl font-semibold text-white">LUMA – Speaking Reports</h1>
      {loading && <p className={adminTokens.mutedText}>Loading reports…</p>}
      {error && (
        <p className={adminTokens.errorNotice}>Error loading reports: {error}</p>
      )}
      {!loading && !error && reports.length === 0 && (
        <p className={adminTokens.mutedText}>
          No reports found. Run a speaking test first.
        </p>
      )}

      {reports.length > 0 && (
        <div className={adminTokens.tableContainer}>
          <table className={`min-w-full text-xs ${adminTokens.tableDivider}`}>
            <thead className={`text-left ${adminTokens.tableHeader}`}>
              <tr>
                <th className="px-4 py-4">Date</th>
                <th className="px-4 py-4">Name</th>
                <th className="px-4 py-4">Accent</th>
                <th className="px-4 py-4">CEFR</th>
                <th className="px-4 py-4">Fluency</th>
                <th className="px-4 py-4">Pron.</th>
                <th className="px-4 py-4">Grammar</th>
                <th className="px-4 py-4">Vocabulary</th>
                <th className="px-4 py-4">Coherence</th>
              </tr>
            </thead>
            <tbody className={adminTokens.tableDivider}>
              {reports.map((r) => (
                <tr
                  key={r.id}
                  className={`${adminTokens.tableRow} ${adminTokens.tableRowHover} cursor-pointer`}
                  onClick={() => setSelected(r)}
                >
                  <td className="px-4 py-4 whitespace-nowrap">
                    {r.DateTime
                      ? new Date(r.DateTime).toLocaleString()
                      : ""}
                  </td>
                  <td className="px-4 py-4">{r.Name || "-"}</td>
                  <td className="px-4 py-4">
                    {r.AccentDetected || r.LanguagePair || "-"}
                  </td>
                  <td className="px-4 py-4">{r.CEFR_Global || "-"}</td>
                  <td className="px-4 py-4 text-center">
                    {r.Score_Fluency ?? "-"}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {r.Score_Pronunciation ?? "-"}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {r.Score_Grammar ?? "-"}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {r.Score_Vocabulary ?? "-"}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {r.Score_Coherence ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <section className={adminTokens.card}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold text-white">
              Detailed report – {selected.Name || "Unknown candidate"}
            </h2>
            <button
              onClick={() => setSelected(null)}
              className={adminTokens.buttonSecondary}
            >
              Close
            </button>
          </div>
          <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">
            {selected.DateTime &&
              new Date(selected.DateTime).toLocaleString()}
          </p>
          <div className="mt-6 grid gap-6 text-sm md:grid-cols-2 lg:gap-8">
            <div>
              <h3 className="font-semibold text-white">Accent & Level</h3>
              <div className="mt-2 space-y-1 text-slate-200">
                <p>
                  <span className="text-slate-400">Accent:</span>{" "}
                  {selected.AccentDetected || "N/A"}
                </p>
                <p>
                  <span className="text-slate-400">Language pair:</span>{" "}
                  {selected.LanguagePair || "N/A"}
                </p>
                <p>
                  <span className="text-slate-400">CEFR:</span>{" "}
                  {selected.CEFR_Global || "N/A"}
                </p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-white">Scores (0–10)</h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-200">
                <li>
                  <span className="text-slate-400">Fluency:</span>{" "}
                  {selected.Score_Fluency ?? "N/A"}
                </li>
                <li>
                  <span className="text-slate-400">Pronunciation:</span>{" "}
                  {selected.Score_Pronunciation ?? "N/A"}
                </li>
                <li>
                  <span className="text-slate-400">Grammar:</span>{" "}
                  {selected.Score_Grammar ?? "N/A"}
                </li>
                <li>
                  <span className="text-slate-400">Vocabulary:</span>{" "}
                  {selected.Score_Vocabulary ?? "N/A"}
                </li>
                <li>
                  <span className="text-slate-400">Coherence:</span>{" "}
                  {selected.Score_Coherence ?? "N/A"}
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-6 grid gap-6 text-sm md:grid-cols-3 lg:gap-8">
            <div>
              <h3 className="font-semibold text-white">Strengths</h3>
              <p className="mt-2 whitespace-pre-wrap text-slate-200">
                {selected.Strengths || "–"}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white">Weaknesses</h3>
              <p className="mt-2 whitespace-pre-wrap text-slate-200">
                {selected.Weaknesses || "–"}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white">Recommendations</h3>
              <p className="mt-2 whitespace-pre-wrap text-slate-200">
                {selected.Recommendations || "–"}
              </p>
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <h3 className="font-semibold text-white">Transcript summary</h3>
            <p className="text-sm whitespace-pre-wrap text-slate-200">
              {selected.RawTranscript || "–"}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
