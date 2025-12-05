"use client";

import { useRef, useState } from "react";

type Status = "idle" | "connecting" | "active";

export default function LumaSpeakingTestPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [log, setLog] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  function appendLog(msg: string) {
    setLog((l) => [...l, `${new Date().toLocaleTimeString()} – ${msg}`]);
  }

  async function startTest() {
    try {
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
        appendLog("Data channel open.");
        setStatus("active");
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "luma_speaking_report") {
            appendLog("Received speaking report, sending to backend...");
            fetch("/api/report", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(msg)
            }).then(() => {
              appendLog("Report saved to Airtable (if configured).");
            });
          } else {
            appendLog("Event: " + event.data);
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


      {/* Neon / nebula overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.55),transparent_55%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.45),transparent_55%)] mix-blend-screen pointer-events-none" />

      {/* Dark veil for contrast */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-4xl rounded-3xl bg-black/40 border border-white/15 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.75)] px-8 py-10 space-y-8">
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
              When you click <span className="font-semibold">Start test</span>,
              LUMA will talk to you in English and evaluate your speaking
              skills. Use a good microphone, speak naturally, and imagine you
              are in a real exam.
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center gap-6">
            {/* Mic button with glow */}
            <div className="relative flex items-center justify-center">
              {/* Pulsing ring when active */}
              {status !== "idle" && (
                <span className="absolute h-32 w-32 rounded-full bg-fuchsia-500/40 blur-xl animate-ping" />
              )}
              <button
                onClick={startTest}
                disabled={status !== "idle"}
                className="relative h-24 w-24 md:h-28 md:w-28 rounded-full bg-gradient-to-br from-fuchsia-500 via-pink-500 to-rose-500 shadow-xl shadow-fuchsia-700/40 flex items-center justify-center border border-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Start speaking test</span>
                {/* Simple mic icon */}
                <div className="flex flex-col items-center">
                  <div className="h-8 w-4 rounded-full bg-white/90 mb-1" />
                  <div className="h-1.5 w-6 rounded-full bg-white/80" />
                </div>
              </button>
            </div>

            {/* Start / Stop buttons + status */}
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

              <div className="flex items-center gap-2 text-xs text-slate-200/90">
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
              </div>
            </div>
          </div>

          {/* Hidden audio element */}
          <audio ref={audioRef} autoPlay />

          {/* Log panel */}
          <div className="mt-4 rounded-2xl border border-white/15 bg-black/50 backdrop-blur-xl p-4 h-60 overflow-auto text-[11px] font-mono text-slate-100 shadow-inner shadow-black/60">
            {log.length === 0 ? (
              <div className="text-slate-400/80">
                Logs will appear here when the test starts (connection status,
                events from LUMA, report saving, etc.).
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
