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

      const formData = new FormData();
      formData.append(
        "sdp",
        new Blob([offer.sdp ?? ""], { type: "application/sdp" })
      );
      formData.append(
        "session",
        new Blob(
          [
            JSON.stringify({
              type: "realtime",
              model: "gpt-realtime",
              instructions:
                "You are LUMA, the British Institutes speaking examiner AI. Conduct an English speaking exam and finally send a JSON data message with type 'luma_speaking_report' that summarises the assessment."
            })
          ],
          { type: "application/json" }
        )
      );

      const callRes = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${client_secret}`
        },
        body: formData
      });

      if (!callRes.ok) {
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
    <main className="flex flex-col items-center p-6 gap-4">
      <h1 className="text-2xl font-semibold">LUMA – Speaking Test</h1>
      <p className="text-sm text-slate-600 max-w-xl text-center">
        When you click start, LUMA will talk to you in English and evaluate
        your speaking skills. Please use a good microphone and speak clearly.
      </p>
      <div className="flex gap-3">
        <button
          onClick={startTest}
          disabled={status !== "idle"}
          className="px-4 py-2 rounded-lg bg-sky-600 text-white disabled:opacity-50"
        >
          Start test
        </button>
        <button
          onClick={stopTest}
          disabled={status === "idle"}
          className="px-4 py-2 rounded-lg bg-slate-200"
        >
          Stop
        </button>
      </div>
      <audio ref={audioRef} autoPlay />
      <div className="mt-4 w-full max-w-2xl text-xs bg-slate-50 border rounded p-2 h-60 overflow-auto">
        {log.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </main>
  );
}
