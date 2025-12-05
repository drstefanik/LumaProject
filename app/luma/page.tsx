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

  // ---- form registrazione candidato ----
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

  // buffer per il testo del report che arriva in streaming
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
      // validazione form
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
        "https://api.openai.com/v1/realtime/calls?model=gpt-realtime",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${client_secret}`,
            "Content-Type": "application/sdp",
            "OpenAI-Beta": "realtime=v1",
          },
          body: offer.sdp ?? "",
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
      // se non è JSON valido, lo teniamo come testo grezzo
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
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* VIDEO DI SFONDO */}
      <video
        className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-40"
        src="/Luma-project.mp4"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-black/80 via-black/80 to-black/95" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
        {/* HEADER */}
        <div className="flex items-center gap-3 text-sm text-pink-300">
          <span className="flex h-8 items-center rounded-full bg-pink-600/20 px-3 font-semibold">
            <span className="mr-2 h-2 w-2 rounded-full bg-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.9)]" />
            LUMA · Language Understanding Mastery Assistant
          </span>
        </div>

        <section className="mt-2 grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* COLONNA SINISTRA */}
          <div className="flex flex-col gap-6">
            <header className="space-y-3">
              <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
                LUMA – Speaking Test
              </h1>
              <p className="max-w-xl text-sm text-slate-200/90">
                Register the candidate and then click{" "}
                <span className="font-semibold">Start test</span> to begin a
                live speaking session with LUMA. At the end, LUMA will generate
                a structured report on the candidate&apos;s performance.
              </p>

              {/* FORM REGISTRAZIONE */}
              <div className="mt-4 grid gap-3 text-xs text-slate-200 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wide text-slate-400">
                    First name *
                  </label>
                  <input
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-pink-500/40 focus:border-pink-400 focus:ring"
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
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-pink-500/40 focus:border-pink-400 focus:ring"
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
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-pink-500/40 focus:border-pink-400 focus:ring"
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
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-pink-500/40 focus:border-pink-400 focus:ring"
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
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-pink-500/40 focus:border-pink-400 focus:ring"
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
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-pink-500/40 focus:border-pink-400 focus:ring"
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
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-pink-500/40 focus:border-pink-400 focus:ring"
                    placeholder="Placement, certification, work, university..."
                    value={testPurpose}
                    onChange={(e) => setTestPurpose(e.target.value)}
                    disabled={!isIdle}
                  />
                </div>

                <label className="mt-2 flex items-start gap-2 text-[11px] text-slate-300">
                  <input
                    type="checkbox"
                    className="mt-[2px]"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    disabled={!isIdle}
                  />
                  <span>
                    I have read and accept the{" "}
                    <a
                      href="/luma/privacy"
                      target="_blank"
                      className="text-pink-300 underline"
                    >
                      LUMA Privacy Policy
                    </a>
                    . *
                  </span>
                </label>
              </div>
            </header>

            {/* microfono + pulsanti */}
            <div className="flex items-center gap-8">
              <div className="relative flex h-40 w-40 items-center justify-center">
                <div className="absolute h-40 w-40 rounded-full bg-pink-500/20 blur-xl" />
                <div className="absolute h-32 w-32 animate-pulse rounded-full border border-pink-400/60" />
                <div className="absolute h-28 w-28 rounded-full bg-gradient-to-b from-pink-500 to-fuchsia-600 shadow-[0_0_30px_rgba(236,72,153,0.9)]" />
                <span className="relative text-4xl">🎙️</span>
              </div>

              <div className="flex flex-1 flex-col gap-3">
                <div className="flex gap-3">
                  <button
                    onClick={startTest}
                    disabled={!isIdle}
                    className="flex-1 rounded-full bg-pink-600 px-6 py-3 text-sm font-semibold shadow-lg shadow-pink-500/40 transition hover:bg-pink-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isConnecting ? "Connecting..." : "Start test"}
                  </button>

                  <button
                    onClick={stopTest}
                    disabled={!isActive}
                    className="flex-1 rounded-full bg-slate-700/70 px-6 py-3 text-sm font-semibold text-slate-200 shadow transition hover:bg-slate-600/80 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Stop (get report)
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-300/80">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isActive
                          ? "bg-emerald-400"
                          : isEvaluating
                          ? "bg-amber-400"
                          : "bg-slate-500"
                      }`}
                    />
                    <span>
                      {isActive && "Status: Live"}
                      {isEvaluating && "Status: Generating report..."}
                      {isIdle && "Status: Ready"}
                      {isConnecting && "Status: Connecting..."}
                    </span>
                  </div>
                  <div>
                    Timer: {minutes}:{seconds}
                  </div>
                </div>
              </div>
            </div>

            <audio ref={audioRef} autoPlay />

{/* Log hidden */}
            <div className="mt-4 h-56 w-full overflow-auto rounded-xl border border-white/10 bg-black/60 p-3 text-[11px] font-mono text-slate-200">
              {log.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>

            <button
              onClick={hardCloseSession}
              className="mt-2 self-end text-[11px] text-slate-400 underline-offset-2 hover:underline"
            >
              Force close session
            </button>
          </div>

          {/* COLONNA DESTRA */}
          <aside className="flex flex-col gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/70 p-5 text-xs text-slate-100 shadow-xl">
              <h2 className="mb-2 text-sm font-semibold text-pink-300">
                Session insights (live)
              </h2>
              <p className="mb-1">
                <span className="text-slate-400">Status:</span>{" "}
                {isActive && "Speaking exam in progress"}
                {isEvaluating && "Waiting for AI evaluation"}
                {isIdle && "Idle"}
                {isConnecting && "Connecting"}
              </p>
              <p className="mb-1">
                <span className="text-slate-400">Events logged:</span>{" "}
                {log.length}
              </p>
              <p className="mb-4">
                <span className="text-slate-400">Candidate:</span>{" "}
                {report?.parsed?.candidate_name ||
                  candidateFullName ||
                  "—"}{" "}
                {email && (
                  <span className="text-slate-400">({email})</span>
                )}
              </p>

              <h3 className="mb-1 text-xs font-semibold text-slate-300">
                Tips for best results
              </h3>
              <ul className="space-y-1 text-[11px] text-slate-300">
                <li>• Use headphones and a good microphone.</li>
                <li>• Answer in full sentences, not just single words.</li>
                <li>
                  • Imagine you are in an official British Institutes
                  speaking exam.
                </li>
              </ul>
            </div>

            {/* REPORT */}
            <div className="rounded-2xl border border-pink-500/30 bg-black/80 p-5 text-xs text-slate-100 shadow-xl">
              <h2 className="mb-2 text-sm font-semibold text-pink-300">
                Final speaking report
              </h2>

              {!report && (
                <p className="text-[11px] text-slate-400">
                  After you press{" "}
                  <span className="font-semibold">Stop</span>, LUMA will
                  generate here a structured written evaluation of the
                  candidate&apos;s speaking performance.
                </p>
              )}

              {report && (
                <div className="space-y-3 text-[11px]">
                  {report.parsed ? (
                    <>
                      {report.parsed.cefr_level && (
                        <p>
                          <span className="text-slate-400">
                            CEFR level:
                          </span>{" "}
                          <span className="font-semibold">
                            {report.parsed.cefr_level}
                          </span>
                        </p>
                      )}
                      {report.parsed.accent && (
                        <p>
                          <span className="text-slate-400">
                            Detected accent:
                          </span>{" "}
                          {report.parsed.accent}
                        </p>
                      )}
                      {report.parsed.strengths && (
                        <div>
                          <span className="text-slate-400">
                            Main strengths:
                          </span>
                          <ul className="ml-4 list-disc">
                            {report.parsed.strengths.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {report.parsed.weaknesses && (
                        <div>
                          <span className="text-slate-400">
                            Areas to improve:
                          </span>
                          <ul className="ml-4 list-disc">
                            {report.parsed.weaknesses.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {report.parsed.recommendations && (
                        <div>
                          <span className="text-slate-400">
                            Recommendations:
                          </span>
                          <ul className="ml-4 list-disc">
                            {report.parsed.recommendations.map(
                              (s, i) => (
                                <li key={i}>{s}</li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                      {report.parsed.overall_comment && (
                        <p>
                          <span className="text-slate-400">
                            Examiner comment:
                          </span>{" "}
                          {report.parsed.overall_comment}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-slate-300">
                        LUMA generated the following evaluation:
                      </p>
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-black/70 p-2 font-mono text-[10px]">
                        {report.rawText}
                      </pre>
                    </>
                  )}
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

