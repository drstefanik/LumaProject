import Link from "next/link";

export default function ReportsPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Admin Reports</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use a direct report URL to review a specific report.
        </p>
        <div className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Example:{" "}
          <code className="rounded bg-white px-2 py-1 text-xs text-slate-800">
            /admin/reports/REP-1234
          </code>
        </div>
        <div className="mt-6">
          <Link
            href="/admin/login"
            className="text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:text-slate-700"
          >
            Back to admin login
          </Link>
        </div>
      </div>
    </div>
  );
}
