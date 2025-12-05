import Link from "next/link";

const highlights = [
  {
    title: "Instant scoring",
    description:
      "Improve pronunciation, fluency, and coherence with an always-on AI speaking coach.",
  },
  {
    title: "Personalized journeys",
    description:
      "Realistic scenarios and rubrics aligned with University and professional needs.",
  },
  {
    title: "Reports ready to share",
    description:
      "Integrated Admin to track results, trends, and focus areas instantly.",
  },
];

const steps = [
  {
    title: "1. Start the test",
    copy: "Log into LUMA, choose the level, and start speaking right away.",
  },
  {
    title: "2. Get smart feedback",
    copy: "Real-time analysis on vocabulary, grammar, and pronunciation with practical tips.",
  },
  {
    title: "3. Share the reports",
    copy: "Send results to learners or review performance trends in Admin.",
  },
];

export default function HomePage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950" />
        <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-sky-500/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-teal-400/30 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-6 py-16 lg:flex-row lg:items-center lg:py-24">
        <section className="flex-1 space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 ring-1 ring-white/15">
            <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            LUMA - Language Understanding Mastery Assistant
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              LUMA, your speaking coach that is fast, clear, and brilliant.
            </h1>
            <p className="max-w-2xl text-lg text-slate-200 sm:text-xl">
              Train with dynamic simulations, receive instant feedback, and share reports
              ready for learners and teachers. Zero stress, just visible results.
            </p>
          </div>

          <div className="flex flex-col flex-wrap gap-4 sm:flex-row sm:items-center">
            <Link
              href="/luma"
              className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:-translate-y-0.5 hover:bg-sky-400"
            >
              Start the speaking test
            </Link>
            <Link
              href="/admin/luma"
              className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-base font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-white hover:text-white"
            >
              Admin · View reports
            </Link>
            <p className="text-sm text-slate-300">
              No setup. You just need a microphone and 10 minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20 backdrop-blur"
              >
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex-1">
          <div className="relative rounded-3xl border border-white/15 bg-white/5 p-3 shadow-2xl shadow-indigo-900/40 backdrop-blur lg:ml-6">
            <div className="absolute -left-6 -top-6 h-14 w-14 rounded-full bg-sky-400/60 blur-2xl" aria-hidden />
            <div className="absolute -bottom-10 right-10 h-24 w-24 rounded-full bg-emerald-300/30 blur-3xl" aria-hidden />
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <video
                src="/Luma-project.gif"
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover"
                aria-label="LUMA demo in action"
              />
            </div>
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                  Live demo
                </p>
                <p className="text-lg font-semibold text-white">
                  Pronunciation, rhythm, and coherence scored in real time.
                </p>
              </div>
              <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold uppercase text-emerald-200 ring-1 ring-emerald-200/40">
                24/7
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="relative mx-auto max-w-5xl px-6 pb-16">
        <div className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl shadow-black/20 backdrop-blur sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.title} className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-200">
                {step.title}
              </p>
              <p className="text-base leading-relaxed text-slate-100">{step.copy}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
