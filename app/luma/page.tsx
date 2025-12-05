"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "connecting" | "active";

export default function LumaSpeakingTestPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [lastEventType, setLastEventType] = useState<string | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  function appendLog(msg: string) {
    setLog((l) => {
      const next = [...l, `${new Date().toLocaleTimeString()} – ${msg}`];
      return next.slice(-80); // solo ultime 80 righe
    });
  }

  // Timer durata sessione
  useEffect(() => {
    if (status === "idle") {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  async function startTest() {
    try {
      if (status !== "idle") return;

      setStatus("connecting");
      setLog([]);
      setLastEventType(null);
      setEventCount(0);

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
        appendLog("Data channel open.");
        setStatus("active");
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const type = msg.type ?? "unknown";
          setLastEventType(type);
          setEventCount((c) => c + 1);

          if (type === "luma_speaking_report") {
            appendLog("Received speaking report, sending to backend...");
            fetch("/api/report", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(msg)
            }).then(() => {
              appendLog("Report saved to Airtable (if configured).");
            });
          } else {
            appendLog(`Event: ${type}`);
          }
        } catch {
          appendLog("Raw message: " + event.data);
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
        const text = await callRes.text();
        console.error("Realtime call error:", text);
        appendLog("Failed to create realtime call.");
        setStatus("idle");
        return;
      }

      const answerSdp = await callRes.text();
      await pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp
      });

      appendLog("LUMA connected. Start speaking in English!");
    } catch (err: any) {
      console.error(err);
      appendLog("Error: " + (err?.message || "unknown"));
      setStatus("idle");
    }
  }

  function stopTest() {
    peerRef.current?.close();
    peerRef.current = null;
    setStatus("idle");
    appendLog("Session closed.");
  }

  const statusLabel =
    status === "idle"
      ? "Ready"
      : status === "connecting"
      ? "Connecting to LUMA…"
      : "LUMA is listening";

  const formattedTime = `${String(Math.floor(elapsed / 60)).padStart(
    2,
    "0"
  )}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* 🔮 Background video */}
      <video
        className="fixed inset-0 w-full h-full object-cover opacity-40 pointer-events-none"
        src="/Luma-project.mp4"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Nebula overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.55),transparent_55%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.45),transparent_55%)] mix-blend-screen pointer-events-none" />

      {/* Dark veil */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-5xl rounded-3xl bg-black/40 border border-white/15 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.85)] px-8 py-10 space-y-8">
          {/* Header */}
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-medium tracking-wide border border-white/20">
              <span className="h-2 w-2 rounded-full bg-fuchsia-400 animate-pulse" />
              LUMA · Language Understanding Mastery Assistant
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-lg">
              LUMA – Speaking Test
            </h1>
            <p className="max-w-2xl text-sm md:text-base text-slate-200/90">
              Click <span className="font-semibold">Start test</span> to begin a
              live speaking session with LUMA. Speak naturally, as in a real
              exam. At the end, LUMA will generate a structured report on your
              performance.
            </p>
          </div>

          {/* Middle: mic + waveform + status */}
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-8 items-center">
            {/* Left */}
            <div className="flex flex-col items-center gap-6">
              <div className="relative flex items-center justify-center">
                {status !== "idle" && (
                  <span className="absolute h-36 w-36 rounded-full bg-fuchsia-500/40 blur-xl animate-pulse" />
                )}

                <button
                  onClick={startTest}
                  disabled={status !== "idle"}
                  className="relative h-28 w-28 md:h-32 md:w-32 rounded-full bg-gradient-to-br from-fuchsia-500 via-pink-500 to-rose-500 shadow-xl shadow-fuchsia-700/40 flex items-center justify-center border border-white/40 disabled:opacity-40 disabled:cursor-not-allowed transition-transform hover:scale-105"
                >
                  <span className="sr-only">Start speaking test</span>
                  <div className="flex flex-col items-center">
                    <div className="h-9 w-5 rounded-full bg-white/90 mb-1" />
                    <div className="h-1.5 w-7 rounded-full bg-white/80" />
                  </div>
                </button>
              </div>

              {/* Waveform */}
              <div className="h-8 flex items-end gap-1">
                {Array.from({ length: 18 }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-1 rounded-full bg-fuchsia-300 transition-all duration-300 ${
                      status === "active"
                        ? "h-8 animate-pulse"
                        : status === "connecting"
                        ? "h-4 animate-pulse"
                        : "h-1 bg-slate-500"
                    }`}
                    style={{ animationDelay: `${i * 40}ms` }}
                  />
                ))}
              </div>

              {/* Buttons + status */}
              <div className="flex flex-col items-center gap-3">
                <div className="flex gap-3">
                  <button
                    onClick={startTest}
                    disabled={status !== "idle"}
                    className="px-6 py-2.5 rounded-full bg-pink-500 text-sm font-semibold shadow-lg shadow-pink-700/40 hover:bg-pink-600 disabled:opacity-40"
                  >
                    Start test
                  </button>
                  <button
                    onClick={stopTest}
                    disabled={status === "idle"}
                    className="px-6 py-2.5 rounded-full bg-white/10 text-sm font-semibold text-slate-100 border border-white/20 hover:bg-white/15 disabled:opacity-40"
                  >
                    Stop
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-200/90">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      status === "active"
                        ? "bg-emerald-400 animate-pulse"
                        : status === "connecting"
                        ? "bg-amber-300 animate-pulse"
                        : "bg-slate-400"
                    }`}
                  />
                  <span>{statusLabel}</span>
                  <span className="w-px h-4 bg-white/20" />
                  <span>Timer: {formattedTime}</span>
                </div>
              </div>
            </div>

            {/* Right: session info */}
            <div className="rounded-2xl bg-white/5 border border-white/15 p-4 md:p-5 space-y-3 text-sm">
              <h2 className="text-sm font-semibold text-fuchsia-200">
                Session insights (live)
              </h2>
              <div className="space-y-1 text-xs text-slate-100/90">
                <p>
                  <span className="font-semibold">Last event:</span>{" "}
                  {lastEventType ?? "—"}
                </p>
                <p>
                  <span className="font-semibold">Events received:</span>{" "}
                  {eventCount}
                </p>
                <p>
                  <span className="font-semibold">Report status:</span>{" "}
                  {log.some((l) =>
                    l.toLowerCase().includes("report saved to airtable")
                  )
                    ? "✅ Saved"
                    : "Waiting for AI evaluation…"}
                </p>
              </div>

              <div className="mt-3 border-t border-white/10 pt-3 text-xs text-slate-200/90 space-y-1">
                <p className="font-semibold text-slate-50">
                  Tips for best results
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Use headphones and a good microphone.</li>
                  <li>Answer in full sentences, not just single words.</li>
                  <li>
                    Imagine you are in an official British Institutes speaking
                    exam.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Audio hidden */}
          <audio ref={audioRef} autoPlay />

          {/* Log */}
          <div className="mt-4 rounded-2xl border border-white/15 bg-black/55 backdrop-blur-xl p-4 h-60 overflow-auto text-[11px] font-mono text-slate-100 shadow-inner shadow-black/60">
            {log.length === 0 ? (
              <div className="text-slate-400/80">
                Logs will appear here when the test starts (connection status
                and key events from LUMA).
              </div>
            ) : (
              log.map((l, i) => <div key={i}>{l}</div>)
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
