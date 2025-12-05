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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // buffer per il testo del report che arriva in streaming
  const reportBufferRef = useRef<string>("");

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
      // cleanup alla chiusura pagina
      peerRef.current?.close();
      stopTimer();
    };
  }, []);

  async function startTest() {
    try {
      setReport(null);
      reportBufferRef.current = "";
      setStatus("connecting");
      appendLog("Requesting client secret from backend...");

      const res = await fetch("/api/voice/client-secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
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
        audio: true
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

        // Configuriamo la sessione: LUMA è un examiner, niente valutazione finale parlata
        const sessionUpdate = {
          type: "session.update",
          session: {
            instructions:
              "You are LUMA (Language Understanding Mastery Assistant), the official British Institutes speaking examiner AI. " +
              "Conduct a realistic English speaking exam (placement / proficiency). Ask questions, keep the conversation natural, " +
              "and do NOT give the final evaluation or explicit score during the conversation. " +
              "Wait until you receive a 'response.create' event whose response.metadata.purpose is 'speaking_report'. " +
              "Only then you must produce a structured written evaluation in JSON, without speaking it aloud.",
            input_audio_format: "webrtc",
            output_audio_format: "webrtc",
            // turn detection lato server
            turn_detection: { type: "server_vad" }
          }
        };

        dc.send(JSON.stringify(sessionUpdate));
        appendLog("Session configured. Start speaking in English!");
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // 1) Filtriamo gli eventi rumorosi per i log
          if (
            msg.type === "response.output_audio_transcript.delta" ||
            msg.type === "input_audio_buffer.append" ||
            msg.type === "input_audio_buffer.speech_started" ||
            msg.type === "input_audio_buffer.speech_stopped" ||
            msg.type === "output_audio_buffer.delta"
          ) {
            // non logghiamo questi eventi
            return;
          }

          // 2) Transcript comprensibile (se vogliamo visualizzarlo)
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

          // 3) Gestione report finale (solo testo, niente audio)
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
              const fullText = reportBufferRef.current.trim();
              appendLog("Final written evaluation received from LUMA.");
              processFinalReport(fullText);
              return;
            }
          }

          // 4) Log sintetico per gli altri eventi utili
          if (msg.type === "session.created") {
            appendLog("Session created.");
          } else if (msg.type === "response.created") {
            appendLog("Evaluation response created...");
          } else if (msg.type === "response.done") {
            appendLog("Evaluation response completed.");
          } else if (msg.type === "error") {
            appendLog("ERROR from Realtime API: " + msg.error?.message);
          } else if (msg.type?.startsWith("output_audio_buffer.")) {
            appendLog("Event: " + msg.type.replace("output_audio_buffer.", ""));
          } else if (msg.type?.startsWith("input_audio_buffer.")) {
            appendLog("Event: " + msg.type.replace("input_audio_buffer.", ""));
          } else if (msg.type) {
            // log minimalista
            appendLog("Event: " + msg.type);
          }
        } catch {
          // messaggi non JSON (rari)
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
            "Content-Type": "application/sdp"
          },
          body: offer.sdp ?? ""
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
        sdp: answerSdp
      });

      appendLog("LUMA connected. Speak naturally in English.");
    } catch (err: any) {
      console.error(err);
      appendLog("Error: " + (err?.message || "unknown"));
      setStatus("idle");
      stopTimer();
    }
  }

  // Quando clicchi "Stop" chiediamo a LUMA SOLO il report scritto
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
        modalities: ["text"], // niente audio qui
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
          purpose: "speaking_report"
        }
      }
    };

    dc.send(JSON.stringify(event));
  }

  async function processFinalReport(text: string) {
    const trimmed = text.trim();
    let parsed: ReportState["parsed"] | undefined = undefined;

    try {
      // Proviamo a parsare come JSON
      parsed = JSON.parse(trimmed);
    } catch {
      // Se non è JSON, lo salviamo comunque come testo grezzo
    }

    const payload = {
      created_at: new Date().toISOString(),
      rawText: trimmed,
      parsed
    };

    setReport({
      rawText: trimmed,
      parsed
    });

    appendLog("Sending report to backend (Airtable)...");
    try {
      const resp = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
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
      // Non chiudiamo subito la call: lasciamo chiudere dall'utente
      setStatus("active");
    }
  }

  function stopTest() {
    appendLog("Stop pressed. Asking LUMA for final evaluation...");
    stopTimer();
    requestFinalEvaluation();
    // NON chiudiamo ancora la peer connection: aspettiamo il report
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
      {/* VIDEO DI SFONDO – il tuo MP4 */}
      <video
        className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-40"
        src="/Luma-project.mp4"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* overlay per leggere bene il testo */}
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
          {/* COLONNA SINISTRA: microfono + controlli */}
          <div className="flex flex-col gap-6">
            <header className="space-y-3">
              <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
                LUMA – Speaking Test
              </h1>
              <p className="max-w-xl text-sm text-slate-200/90">
                Click <span className="font-semibold">Start test</span> to
                begin a live speaking session with LUMA. Speak naturally, as in
                a real exam. At the end, LUMA will generate a structured report
                on your performance.
              </p>
            </header>

            {/* microfono grande */}
            <div className="flex items-center gap-8">
              <div className="relative flex h-40 w-40 items-center justify-center">
                {/* cerchi animati */}
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
                  <div>Timer: {minutes}:{seconds}</div>
                </div>
              </div>
            </div>

            <audio ref={audioRef} autoPlay />

            {/* LOG COMPATTO */}
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

          {/* COLONNA DESTRA: pannello info + report */}
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
              <p className="mb-4">
                <span className="text-slate-400">Events logged:</span>{" "}
                {log.length}
              </p>

              <h3 className="mb-1 text-xs font-semibold text-slate-300">
                Tips for best results
              </h3>
              <ul className="space-y-1 text-[11px] text-slate-300">
                <li>• Use headphones and a good microphone.</li>
                <li>
                  • Answer in full sentences, not just single words.
                </li>
                <li>
                  • Imagine you are in an official British Institutes speaking
                  exam.
                </li>
              </ul>
            </div>

            {/* REPORT FINALE */}
            <div className="rounded-2xl border border-pink-500/30 bg-black/80 p-5 text-xs text-slate-100 shadow-xl">
              <h2 className="mb-2 text-sm font-semibold text-pink-300">
                Final speaking report
              </h2>

              {!report && (
                <p className="text-[11px] text-slate-400">
                  After you press <span className="font-semibold">Stop</span>,
                  LUMA will generate here a structured written evaluation of
                  your speaking performance.
                </p>
              )}

              {report && (
                <div className="space-y-3 text-[11px]">
                  {report.parsed ? (
                    <>
                      {report.parsed.cefr_level && (
                        <p>
                          <span className="text-slate-400">CEFR level:</span>{" "}
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
                            {report.parsed.recommendations.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
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
