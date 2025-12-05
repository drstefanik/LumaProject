"use client";

import { useEffect, useState } from "react";

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
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">LUMA – Speaking Reports</h1>
      {loading && <p>Loading reports…</p>}
      {error && (
        <p className="text-sm text-red-600">
          Error loading reports: {error}
        </p>
      )}
      {!loading && !error && reports.length === 0 && (
        <p>No reports found. Run a speaking test first.</p>
      )}

      {reports.length > 0 && (
        <div className="overflow-auto border rounded-lg">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-2 py-1 text-left">Date</th>
                <th className="px-2 py-1 text-left">Name</th>
                <th className="px-2 py-1 text-left">Accent</th>
                <th className="px-2 py-1 text-left">CEFR</th>
                <th className="px-2 py-1 text-left">Fluency</th>
                <th className="px-2 py-1 text-left">Pron.</th>
                <th className="px-2 py-1 text-left">Grammar</th>
                <th className="px-2 py-1 text-left">Vocabulary</th>
                <th className="px-2 py-1 text-left">Coherence</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr
                  key={r.id}
                  className="border-t hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelected(r)}
                >
                  <td className="px-2 py-1 whitespace-nowrap">
                    {r.DateTime
                      ? new Date(r.DateTime).toLocaleString()
                      : ""}
                  </td>
                  <td className="px-2 py-1">{r.Name || "-"}</td>
                  <td className="px-2 py-1">
                    {r.AccentDetected || r.LanguagePair || "-"}
                  </td>
                  <td className="px-2 py-1">{r.CEFR_Global || "-"}</td>
                  <td className="px-2 py-1 text-center">
                    {r.Score_Fluency ?? "-"}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {r.Score_Pronunciation ?? "-"}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {r.Score_Grammar ?? "-"}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {r.Score_Vocabulary ?? "-"}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {r.Score_Coherence ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <section className="mt-4 border rounded-lg p-4 bg-white shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <h2 className="font-semibold">
              Detailed report – {selected.Name || "Unknown candidate"}
            </h2>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Close
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-2">
            {selected.DateTime &&
              new Date(selected.DateTime).toLocaleString()}
          </p>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-semibold text-slate-700 mb-1">
                Accent & Level
              </h3>
              <p>
                <strong>Accent:</strong>{" "}
                {selected.AccentDetected || "N/A"}
              </p>
              <p>
                <strong>Language pair:</strong>{" "}
                {selected.LanguagePair || "N/A"}
              </p>
              <p>
                <strong>CEFR:</strong> {selected.CEFR_Global || "N/A"}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-700 mb-1">
                Scores (0–10)
              </h3>
              <ul className="list-disc list-inside">
                <li>Fluency: {selected.Score_Fluency ?? "N/A"}</li>
                <li>
                  Pronunciation: {selected.Score_Pronunciation ?? "N/A"}
                </li>
                <li>Grammar: {selected.Score_Grammar ?? "N/A"}</li>
                <li>
                  Vocabulary: {selected.Score_Vocabulary ?? "N/A"}
                </li>
                <li>
                  Coherence: {selected.Score_Coherence ?? "N/A"}
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-3 grid md:grid-cols-3 gap-3 text-sm">
            <div>
              <h3 className="font-semibold text-slate-700 mb-1">
                Strengths
              </h3>
              <p className="whitespace-pre-wrap">
                {selected.Strengths || "–"}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-700 mb-1">
                Weaknesses
              </h3>
              <p className="whitespace-pre-wrap">
                {selected.Weaknesses || "–"}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-700 mb-1">
                Recommendations
              </h3>
              <p className="whitespace-pre-wrap">
                {selected.Recommendations || "–"}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <h3 className="font-semibold text-slate-700 mb-1">
              Transcript summary
            </h3>
            <p className="text-sm whitespace-pre-wrap">
              {selected.RawTranscript || "–"}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
