"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "connecting" | "active" | "evaluating";

type ReportState = {
  rawText: string;
  parsed?: {
    candidate_name?: string;
    cefr_level?: string;
    accent?: string;
    strengths?: string[];
    weaknesses?: string[];
    recommendations?: string[];
    overall_comment?: string;
  };
};

export default function LumaSpeakingTestPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [timer, setTimer] = useState<number>(0);
  const [report, setReport] = useState<ReportState | null>(null);

  // ---- candidate registration form ----
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [birthDate, setBirthDate] = useState<string>("");
  const [nativeLanguage, setNativeLanguage] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [testPurpose, setTestPurpose] = useState<string>("");
  const [privacyAccepted, setPrivacyAccepted] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // buffer for the streamed report text
  const reportBufferRef = useRef<string>("");

  const candidateFullName = `${firstName} ${lastName}`.trim();

  function appendLog(msg: string) {
    setLog((l) => [...l, `${new Date().toLocaleTimeString()} – ${msg}`]);
  }

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimer(0);
    timerRef.current = setInterval(() => {
      setTimer((t) => t + 1);
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  useEffect(() => {
    return () => {
      peerRef.current?.close();
      stopTimer();
    };
  }, []);

  async function startTest() {
    try {
      // form validation
      if (!candidateFullName) {
        alert("Please enter candidate first name and last name.");
        appendLog("Please enter candidate first name and last name.");
        return;
      }
      if (!email.trim()) {
        alert("Please enter candidate email.");
        appendLog("Please enter candidate email.");
        return;
      }
      if (!privacyAccepted) {
        alert("You must accept the privacy policy to start the test.");
        appendLog("Privacy policy not accepted.");
        return;
      }

      setReport(null);
      reportBufferRef.current = "";
      setStatus("connecting");
      appendLog("Requesting client secret from backend...");

      const res = await fetch("/api/voice/client-secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        appendLog("Error from backend creating client secret.");
        setStatus("idle");
        return;
      }

      const { client_secret } = await res.json();
      if (!client_secret) {
        appendLog("No client secret received.");
        setStatus("idle");
        return;
      }

      appendLog("Acquiring microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const pc = new RTCPeerConnection();
      peerRef.current = pc;

      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        if (!audioRef.current) return;
        audioRef.current.srcObject = event.streams[0];
        audioRef.current
          .play()
          .then(() => {
            appendLog("Playing audio from LUMA.");
          })
          .catch(() => {});
      };

      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onopen = () => {
        appendLog("Data channel open. Configuring LUMA session...");
        setStatus("active");
        startTimer();

        const sessionUpdate = {
          type: "session.update",
          session: {
            type: "realtime",
            model: "gpt-realtime",
            instructions: `
You are LUMA (Language Understanding Mastery Assistant), the official British Institutes speaking examiner AI.

The candidate's name is "${candidateFullName}".
${nativeLanguage ? `The candidate's native language is ${nativeLanguage}.` : ""}
${country ? `The candidate is currently in ${country}.` : ""}
${testPurpose ? `The purpose of this test is: ${testPurpose}.` : ""}

ROLE
- You conduct a realistic English speaking exam (placement / proficiency).
- Ask questions, keep the conversation natural, and listen carefully.
- Do NOT give the final evaluation or explicit score during the conversation.

STRICT LANGUAGE POLICY (NON-NEGOTIABLE)
- You MUST ALWAYS speak ONLY in English.
- You MUST NEVER speak Italian or any other language.
- If the candidate speaks in Italian or any other non-English language, you MUST:
  • continue speaking only in English;
  • immediately remind them with a short sentence such as:
    "Please answer in English. This speaking test must be completed in English only."
    "I can only conduct this test in English. Please continue in English, even if it is not perfect."

TONE & INTERACTION
- Speak clearly, politely, and professionally.
- Ask one question at a time and wait for the candidate's answer.
- Keep your responses short and focused.
- If you do not understand the candidate, say:
  "I'm sorry, could you repeat that in English, please?"
- If the candidate is silent for a while, say:
  "Take your time. Please answer in English when you are ready."

EVALUATION & REPORT
- During the conversation, do NOT state or imply any score, level, or CEFR band.
- Do NOT mention JSON, internal reasoning, or technical details.
- Wait until you receive a 'response.create' event whose response.metadata.purpose is 'speaking_report'.
- Only then produce a structured written evaluation in JSON, but NEVER read it aloud or reveal it to the candidate.
`,
          },
        };

        dc.send(JSON.stringify(sessionUpdate));
        appendLog("Session configured. Start speaking in English!");
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (
            msg.type === "response.output_audio_transcript.delta" ||
            msg.type === "input_audio_buffer.append" ||
            msg.type === "input_audio_buffer.speech_started" ||
            msg.type === "input_audio_buffer.speech_stopped" ||
            msg.type === "output_audio_buffer.delta"
          ) {
            return;
          }

          if (msg.type === "response.output_audio_transcript.done") {
            const text =
              msg.output_audio_transcript?.join("") ??
              msg.output_text ??
              "";
            if (text) {
              appendLog(`LUMA: ${text}`);
            }
            return;
          }

          if (
            (msg.type === "response.output_text.delta" ||
              msg.type === "response.output_text.done") &&
            msg.response?.metadata?.purpose === "speaking_report"
          ) {
            if (msg.type === "response.output_text.delta") {
              const deltaText = msg.delta?.text ?? "";
              reportBufferRef.current += deltaText;
              return;
            }

            if (msg.type === "response.output_text.done") {
              const fullText =
                reportBufferRef.current.trim() ||
                (Array.isArray(msg.output_text)
                  ? msg.output_text.join("")
                  : msg.output_text || "").toString().trim() ||
                (Array.isArray(msg.response?.output_text)
                  ? msg.response.output_text.join("")
                  : msg.response?.output_text || "").toString().trim();

              if (!fullText) {
                appendLog(
                  "No written evaluation received from LUMA. Please try stopping the test again."
                );
                setStatus("active");
                return;
              }

              appendLog("Final written evaluation received from LUMA.");
              processFinalReport(fullText);
              return;
            }
          }

          if (msg.type === "session.created") {
            appendLog("Session created.");
          } else if (msg.type === "response.created") {
            appendLog("Evaluation response created...");
          } else if (msg.type === "response.done") {
            appendLog("Evaluation response completed.");
          } else if (msg.type === "error") {
            appendLog("ERROR from Realtime API: " + msg.error?.message);
          } else if (msg.type?.startsWith("output_audio_buffer.")) {
            appendLog(
              "Event: " + msg.type.replace("output_audio_buffer.", "")
            );
          } else if (msg.type?.startsWith("input_audio_buffer.")) {
            appendLog(
              "Event: " + msg.type.replace("input_audio_buffer.", "")
            );
          } else if (msg.type) {
            appendLog("Event: " + msg.type);
          }
        } catch {
          // ignore non-JSON messages
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      appendLog("Sending SDP offer to OpenAI Realtime API...");

const callRes = await fetch(
  "https://api.openai.com/v1/realtime",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${client_secret}`,
      "Content-Type": "application/sdp",
      "OpenAI-Beta": "realtime=v1",
    },
    body: offer.sdp || "",
  }
);




      if (!callRes.ok) {
        appendLog("Failed to create realtime call.");
        setStatus("idle");
        stopTimer();
        return;
      }

      const answerSdp = await callRes.text();
      await pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });

      appendLog("LUMA connected. Speak naturally in English.");
    } catch (err: any) {
      console.error(err);
      appendLog("Error: " + (err?.message || "unknown"));
      setStatus("idle");
      stopTimer();
    }
  }

  function requestFinalEvaluation() {
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== "open") {
      appendLog("Data channel not open. Cannot request evaluation.");
      return;
    }

    setStatus("evaluating");
    appendLog(
      "Requesting final written evaluation from LUMA (no spoken feedback)..."
    );
    reportBufferRef.current = "";

    const event = {
      type: "response.create",
      response: {
        modalities: ["text"],
        instructions:
          "Now, as LUMA, produce ONLY a structured JSON evaluation of the candidate's English speaking performance. " +
          "Do NOT speak this aloud, only return JSON. " +
          "Use this exact schema: " +
          "{ \"candidate_name\": string | null, " +
          "\"cefr_level\": string, " +
          "\"accent\": string, " +
          "\"strengths\": string[], " +
          "\"weaknesses\": string[], " +
          "\"recommendations\": string[], " +
          "\"overall_comment\": string }.",
        metadata: {
          purpose: "speaking_report",
        },
      },
    };

    dc.send(JSON.stringify(event));
  }

  async function processFinalReport(text: string) {
    const trimmed = text.trim();
    let parsed: ReportState["parsed"] | undefined = undefined;

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // if the payload is not valid JSON, keep raw text
    }

    const payload = {
      created_at: new Date().toISOString(),
      rawText: trimmed,
      parsed,

      candidate_name: candidateFullName || null,
      candidate_first_name: firstName.trim() || null,
      candidate_last_name: lastName.trim() || null,
      candidate_email: email.trim() || null,
      birth_date: birthDate || null,
      native_language: nativeLanguage || null,
      country: country || null,
      test_purpose: testPurpose || null,
      privacy_accepted: privacyAccepted,
    };

    setReport({
      rawText: trimmed,
      parsed,
    });

    appendLog("Sending report to backend (Airtable)...");
    try {
      const resp = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const t = await resp.text();
        appendLog("Error saving report: " + t);
      } else {
        appendLog("Report saved to Airtable (if configured).");
      }
    } catch (e: any) {
      appendLog(
        "Network error while saving report: " + (e?.message || "unknown")
      );
    } finally {
      setStatus("active");
    }
  }

  function stopTest() {
    appendLog("Stop pressed. Asking LUMA for final evaluation...");
    stopTimer();
    requestFinalEvaluation();
  }

  function hardCloseSession() {
    peerRef.current?.close();
    peerRef.current = null;
    setStatus("idle");
    stopTimer();
    appendLog("Session closed.");
  }

  const minutes = String(Math.floor(timer / 60)).padStart(2, "0");
  const seconds = String(timer % 60).padStart(2, "0");
  const isIdle = status === "idle";
  const isConnecting = status === "connecting";
  const isActive = status === "active";
  const isEvaluating = status === "evaluating";

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        <div className="absolute -left-16 -top-24 h-72 w-72 rounded-full bg-sky-500/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="absolute -right-20 top-10 h-72 w-72 rounded-full bg-teal-400/25 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-12 space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-sky-100 ring-1 ring-white/15">
          <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
          British Institutes · Speaking Examiner
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col gap-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-indigo-900/50 backdrop-blur">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <h1 className="text-4xl font-black leading-tight sm:text-5xl">
                    LUMA Speaking Test
                  </h1>
                  <p className="max-w-2xl text-sm leading-relaxed text-slate-200">
                    Register the candidate, start the live conversation, and let LUMA score pronunciation, rhythm, and coherence in real time.
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1 text-emerald-100 ring-1 ring-emerald-300/40">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      {status === "idle"
                        ? "Ready to start"
                        : status === "connecting"
                          ? "Connecting to LUMA"
                          : status === "active"
                            ? "Live session"
                            : "Generating report"}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-white ring-1 ring-white/20">
                      ⏱ {minutes}:{seconds}
                    </span>
                  </div>
                </div>
                <div className="relative w-full max-w-xs self-center overflow-hidden rounded-2xl border border-white/15 bg-white/5 p-2 shadow-lg shadow-indigo-900/40">
                  <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/15 via-indigo-500/10 to-transparent" />
                  <video
                    src="/Luma-project.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="relative h-36 w-full rounded-xl object-cover"
                    aria-label="LUMA demo clip"
                  />
                  <p className="relative mt-2 text-[11px] text-slate-200">
                    Instant scoring preview
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 text-xs text-slate-100 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wide text-slate-400">
                    First name *
                  </label>
                  <input
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-1 ring-transparent transition focus:border-sky-400/60 focus:ring-sky-500/40"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={!isIdle}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wide text-slate-400">
                    Last name *
                  </label>
                  <input
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-1 ring-transparent transition focus:border-sky-400/60 focus:ring-sky-500/40"
                    placeholder="Smith"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={!isIdle}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wide text-slate-400">
                    Email *
                  </label>
                  <input
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-1 ring-transparent transition focus:border-sky-400/60 focus:ring-sky-500/40"
                    placeholder="candidate@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!isIdle}
                    type="email"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wide text-slate-400">
                    Date of birth
                  </label>
                  <input
                    type="date"
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-1 ring-transparent transition focus:border-sky-400/60 focus:ring-sky-500/40"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    disabled={!isIdle}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wide text-slate-400">
                    Native language
                  </label>
                  <input
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-1 ring-transparent transition focus:border-sky-400/60 focus:ring-sky-500/40"
                    placeholder="Italian, Spanish, Arabic..."
                    value={nativeLanguage}
                    onChange={(e) => setNativeLanguage(e.target.value)}
                    disabled={!isIdle}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wide text-slate-400">
                    Country
                  </label>
                  <input
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-1 ring-transparent transition focus:border-sky-400/60 focus:ring-sky-500/40"
                    placeholder="Italy, UAE, Spain..."
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    disabled={!isIdle}
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2 text-xs text-slate-200">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wide text-slate-400">
                    Purpose of the test
                  </label>
                  <input
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-1 ring-transparent transition focus:border-sky-400/60 focus:ring-sky-500/40"
                    placeholder="Placement, certification, work, university..."
                    value={testPurpose}
                    onChange={(e) => setTestPurpose(e.target.value)}
                    disabled={!isIdle}
                  />
                </div>

                <label className="mt-2 flex items-start gap-2 text-[11px] text-slate-300">
                  <input
                    type="checkbox"
                    className="mt-[2px] accent-sky-400"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    disabled={!isIdle}
                  />
                  <span>
                    I have read and accept the{" "}
                    <a
                      href="/luma/privacy"
                      target="_blank"
                      className="text-sky-200 underline"
                    >
                      LUMA Privacy Policy
                    </a>
                    . *
                  </span>
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-indigo-900/50 backdrop-blur">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
                <div className="relative flex h-28 w-28 items-center justify-center self-start lg:self-center">
                  <div className="absolute h-28 w-28 rounded-full bg-sky-500/20 blur-xl" />
                  <div className="absolute h-24 w-24 animate-pulse rounded-full border border-sky-400/60" />
                  <div className="absolute h-20 w-20 rounded-full bg-gradient-to-b from-sky-500 to-indigo-600 shadow-[0_0_30px_rgba(56,189,248,0.6)]" />
                  <span className="relative text-3xl">🎙️</span>
                </div>

                <div className="flex-1 space-y-3 text-sm text-slate-100">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={startTest}
                      disabled={!isIdle}
                      className="flex-1 rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:-translate-y-0.5 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isConnecting ? "Connecting..." : "Start test"}
                    </button>
                    <button
                      onClick={stopTest}
                      disabled={!isActive}
                      className="flex-1 rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isEvaluating ? "Evaluating..." : "Stop"}
                    </button>
                  </div>
                  <button
                    onClick={hardCloseSession}
                    className="w-full rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/40 hover:text-white"
                  >
                    Close session
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-[11px]">
                    <span className="flex items-center gap-2 font-semibold text-sky-100">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-sky-300" />
                      {status === "idle"
                        ? "Ready"
                        : status === "connecting"
                          ? "Connecting"
                          : status === "active"
                            ? "Live"
                            : "Evaluating"}
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white">
                      {minutes}:{seconds}
                    </span>
                    <p className="text-slate-300">Keep this tab active. LUMA speaks only in English.</p>
                  </div>
                  <audio ref={audioRef} className="hidden" />
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-indigo-900/50 backdrop-blur">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-sky-200">Session log</h2>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-wide text-slate-300">
                  Live transcript
                </span>
              </div>

              <div className="mt-3 max-h-64 overflow-auto rounded-2xl border border-white/5 bg-black/40 p-3">
                {log.length === 0 ? (
                  <p className="text-[11px] text-slate-400">No events yet. Start the test to see the conversation.</p>
                ) : (
                  <ul className="space-y-1">
                    {log.map((entry, idx) => (
                      <li key={idx} className="text-[11px] text-slate-200">
                        {entry}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="overflow-hidden rounded-3xl border border-white/15 bg-white/5 shadow-2xl shadow-indigo-900/40">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/10 via-indigo-500/5 to-transparent" />
                <video
                  src="/Luma-project.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="h-56 w-full object-cover"
                />
              </div>
              <div className="space-y-2 p-5 text-sm text-slate-200">
                <p className="text-[11px] uppercase tracking-[0.2em] text-sky-200">Live demo</p>
                <p className="text-base font-semibold text-white">
                  Pronunciation, rhythm, and coherence scored in real time.
                </p>
                <p className="text-[12px] leading-relaxed text-slate-300">
                  The clip mirrors the homepage experience so candidates can preview how LUMA listens and prepares the final report.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-2xl shadow-indigo-900/40 backdrop-blur">
              <h3 className="text-sm font-semibold text-sky-200">Candidate</h3>
              <p className="mt-1 text-base font-semibold text-white">
                {candidateFullName || "—"}{" "}
                {email && <span className="text-slate-400">({email})</span>}
              </p>

              <h3 className="mb-1 mt-4 text-xs font-semibold text-slate-300">Tips for best results</h3>
              <ul className="space-y-1 text-[12px] text-slate-300">
                <li>• Use headphones and a clear microphone.</li>
                <li>• Answer in full sentences, not single words.</li>
                <li>• Imagine you are in an official British Institutes speaking exam.</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/5 p-5 text-sm text-slate-100 shadow-2xl shadow-indigo-900/40 backdrop-blur">
              <h2 className="mb-2 text-sm font-semibold text-sky-200">Final speaking report</h2>

              {!report && (
                <p className="text-[12px] text-slate-300">
                  After you press <span className="font-semibold text-white">Stop</span>, LUMA will generate here a structured written evaluation of the candidate&apos;s speaking performance.
                </p>
              )}

              {report && (
                <div className="space-y-3 text-[12px]">
                  {report.parsed ? (
                    <>
                      {report.parsed.cefr_level && (
                        <p>
                          <span className="text-slate-400">CEFR level:</span>{" "}
                          <span className="font-semibold">{report.parsed.cefr_level}</span>
                        </p>
                      )}
                      {report.parsed.accent && (
                        <p>
                          <span className="text-slate-400">Detected accent:</span>{" "}
                          {report.parsed.accent}
                        </p>
                      )}
                      {report.parsed.strengths && (
                        <div>
                          <span className="text-slate-400">Main strengths:</span>
                          <ul className="ml-4 list-disc">
                            {report.parsed.strengths.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {report.parsed.weaknesses && (
                        <div>
                          <span className="text-slate-400">Areas to improve:</span>
                          <ul className="ml-4 list-disc">
                            {report.parsed.weaknesses.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {report.parsed.recommendations && (
                        <div>
                          <span className="text-slate-400">Recommendations:</span>
                          <ul className="ml-4 list-disc">
                            {report.parsed.recommendations.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {report.parsed.overall_comment && (
                        <p>
                          <span className="text-slate-400">Examiner comment:</span>{" "}
                          {report.parsed.overall_comment}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-slate-300">LUMA generated the following evaluation:</p>
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-black/60 p-2 font-mono text-[11px]">
                        {report.rawText}
                      </pre>
                    </>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
