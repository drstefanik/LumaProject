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

      // invio audio locale verso LUMA
      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // ricezione audio da LUMA
      pc.ontrack = (event) => {
        if (!audioRef.current) return;
        audioRef.current.srcObject = event.streams[0];
        audioRef.current
          .play()
          .then(() => {
            appendLog("Playing audio from LUMA.");
          })
          .catch(() => {
            /* ignore */
          });
      };

      // data channel per eventi JSON (report finale, ecc.)
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

      // creazione SDP offer WebRTC
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      appendLog("Sending SDP offer to OpenAI Realtime API...");

      // 👉 chiamata corretta: solo SDP come body, modello in query
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

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden">
      {/* Background video */}
      <video
        className="absolute inset-0 w-full h-full object-cover opacity-40"
        src="/Luma-project.mp4"  // assicurati che il nome del file sia identico
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Gradient overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />

      {/* Foreground content */}
      <div className="relative z-10 max-w-2xl w-full p-6">
        <h1 className="text-4xl font-bold text-white text-center drop-shadow-lg">
          LUMA – Speaking Test
        </h1>

        <p className="text-sm text-slate-200 text-center mt-2 drop-shadow">
          When you click start, LUMA will talk to you in English and evaluate
          your speaking skills. Please use a good microphone and speak clearly.
        </p>

        <div className="flex gap-3 justify-center mt-6">
          <button
            onClick={startTest}
            disabled={status !== "idle"}
            className="px-5 py-2 rounded-lg bg-pink-600 text-white font-semibold shadow-lg hover:bg-pink-700 disabled:opacity-40"
          >
            Start test
          </button>

          <button
            onClick={stopTest}
            disabled={status === "idle"}
            className="px-5 py-2 rounded-lg bg-white/20 text-white font-semibold backdrop-blur hover:bg-white/30 disabled:opacity-40"
          >
            Stop
          </button>
        </div>

        <audio ref={audioRef} autoPlay />

        {/* Log panel */}
        <div className="mt-6 w-full text-xs bg-black/40 backdrop-blur border border-white/20 text-white rounded p-3 h-60 overflow-auto shadow-inner">
          {log.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
    </main>
  );
}
