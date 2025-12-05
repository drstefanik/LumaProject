import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-bold">LUMA – Speaking Examiner</h1>
      <p className="text-slate-600 max-w-xl text-center">
        Welcome to LUMA (Language Understanding Mastery Assistant), the
        British Institutes AI for English speaking practice and assessment.
      </p>
      <div className="flex gap-4">
        <Link
          href="/luma"
          className="rounded-lg bg-sky-600 px-4 py-2 text-white font-medium hover:bg-sky-700"
        >
          Start Speaking Test
        </Link>
        <Link
          href="/admin/luma"
          className="rounded-lg border border-slate-300 px-4 py-2 text-slate-800 hover:bg-slate-100"
        >
          Admin – View Reports
        </Link>
      </div>
    </main>
  );
}
