"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";

type Status = "idle" | "connecting" | "active" | "evaluating";

const REALTIME_MODEL =
  process.env.NEXT_PUBLIC_REALTIME_MODEL ?? "gpt-4o-realtime-preview-2024-12-17";

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

const NATIVE_LANGUAGES = [
  "English",
  "Italian",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Russian",
  "Arabic",
  "Mandarin Chinese",
  "Cantonese",
  "Hindi",
  "Bengali",
  "Urdu",
  "Turkish",
  "Dutch",
  "Swedish",
  "Norwegian",
  "Danish",
  "Finnish",
  "Polish",
  "Czech",
  "Slovak",
  "Hungarian",
  "Greek",
  "Romanian",
  "Bulgarian",
  "Ukrainian",
  "Serbian",
  "Croatian",
  "Bosnian",
  "Korean",
  "Japanese",
  "Thai",
  "Vietnamese",
  "Filipino",
  "Indonesian",
  "Malay",
  "Persian",
  "Hebrew",
  "Swahili",
  "Amharic",
  "Somali",
  "Yoruba",
  "Zulu",
  "Afrikaans",
  "Other",
];

const TEST_PURPOSES = [
  "University Admission",
  "Erasmus/Exchange Program",
  "Job Application",
  "Career Advancement",
  "Visa or Immigration",
  "Professional Certification",
  "Language Course Placement",
  "Personal Improvement",
  "Exam Preparation (IELTS/TOEFL)",
  "School Requirement",
  "Scholarship Requirement",
  "Other",
];

type SearchableSelectProps = {
  label: string;
  placeholder?: string;
  options: string[];
  value: string;
  onChange: (newValue: string) => void;
  required?: boolean;
  disabled?: boolean;
};

function SearchableSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  required,
  disabled,
}: SearchableSelectProps) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (highlightedIndex >= filteredOptions.length) {
      setHighlightedIndex(0);
    }
  }, [filteredOptions.length, highlightedIndex]);

  function handleSelect(option: string) {
    setQuery(option);
    onChange(option);
    setIsOpen(false);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    setQuery(newValue);
    onChange(newValue);
    setIsOpen(!disabled);
    setHighlightedIndex(0);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) =>
        filteredOptions.length === 0
          ? 0
          : (prev + 1) % filteredOptions.length
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) =>
        filteredOptions.length === 0
          ? 0
          : (prev - 1 + filteredOptions.length) % filteredOptions.length
      );
    } else if (e.key === "Enter" && isOpen && filteredOptions.length > 0) {
      e.preventDefault();
      handleSelect(filteredOptions[highlightedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      <label className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
        {required ? " *" : ""}
      </label>
      <div className="relative">
        <input
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-1 ring-transparent transition focus:border-sky-400/60 focus:ring-sky-500/40"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => !disabled && setIsOpen(true)}
          onClick={() => !disabled && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />

        {isOpen && filteredOptions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-slate-900/90 shadow-lg shadow-black/40">
            <ul className="max-h-52 overflow-y-auto text-xs text-slate-100">
              {filteredOptions.map((option, idx) => (
                <li key={option}>
                  <button
                    type="button"
                    className={`flex w-full items-start px-3 py-2 text-left transition hover:bg-white/10 ${
                      idx === highlightedIndex ? "bg-white/10" : ""
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(option)}
                  >
                    {option}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LumaSpeakingTestPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [timer, setTimer] = useState<number>(0);
  const [report, setReport] = useState<ReportState | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);

  // candidate form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [country, setCountry] = useState("");
  const [testPurpose, setTestPurpose] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const sessionInitializedRef = useRef(false);
  const responseMetadataRef = useRef<Record<string, string | undefined>>({});

  const reportBufferRef = useRef<string>("");

  const candidateFullName = `${firstName} ${lastName}`.trim();

  function appendLog(msg: string) {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()} – ${msg}`]);
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
    if (audioRef.current) {
      audioRef.current.autoplay = true;
      audioRef.current.setAttribute("playsinline", "true");
    }

    return () => {
      peerRef.current?.close();
      wsRef.current?.close();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      stopTimer();
    };
  }, []);

  function stopMicrophoneTracks() {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
  }

  async function startTest() {
    console.log("[LUMA] Start test clicked");

    try {
      if (typeof window === "undefined") {
        appendLog("Start test ignored on server.");
        return;
      }

      if (!isIdle) {
        appendLog("Test already running or connecting.");
        return;
      }

      if (!candidateFullName) {
        alert("Please enter candidate first and last name.");
        appendLog("Missing candidate name.");
        return;
      }
      if (!email.trim()) {
        alert("Please enter candidate email.");
        appendLog("Missing candidate email.");
        return;
      }
      if (!nativeLanguage.trim()) {
        alert("Please select the candidate's native language.");
        appendLog("Missing native language.");
        return;
      }
      if (!testPurpose.trim()) {
        alert("Please select the purpose of the test.");
        appendLog("Missing test purpose.");
        return;
      }
      if (!privacyAccepted) {
        alert("You must accept the privacy policy to start the test.");
        appendLog("Privacy policy not accepted.");
        return;
      }

      setReport(null);
      setCandidateId(null);
      reportBufferRef.current = "";
      sessionInitializedRef.current = false;
      responseMetadataRef.current = {};
      setStatus("connecting");

      appendLog("Registering candidate...");
      const candidateRes = await fetch("/api/candidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          dateOfBirth: birthDate,
          country: country.trim(),
          nativeLanguage: nativeLanguage.trim(),
          testPurpose: testPurpose.trim(),
          privacyConsent: privacyAccepted,
        }),
      });

      if (!candidateRes.ok) {
        const errorText = await candidateRes.text();
        console.error("Candidate registration failed:", errorText);
        appendLog("Error registering candidate: " + errorText);
        setStatus("idle");
        return;
      }

      const candidateJson = await candidateRes.json();
      const backendCandidateId = (candidateJson.candidateId || candidateJson.recordId) as
        | string
        | undefined;

      if (!backendCandidateId) {
        appendLog("Candidate registration failed: missing candidateId.");
        setStatus("idle");
        return;
      }

      setCandidateId(backendCandidateId);
      console.log("[LUMA] Candidate saved");
      appendLog("Requesting client secret from backend...");

      const res = await fetch("/api/client-secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: backendCandidateId,
          candidateEmail: email.trim(),
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Client secret creation failed:", errorText);
        appendLog("Error from backend creating client secret.");
        setStatus("idle");
        return;
      }

      const json = await res.json();
      const clientSecret = json.client_secret as string | undefined;
      console.log("[LUMA] Client secret received", clientSecret);

      if (!clientSecret) {
        appendLog("No client secret received.");
        setStatus("idle");
        return;
      }

      const pc = new RTCPeerConnection();
      peerRef.current = pc;

      let hasLoggedRemoteAudio = false;
      let firstModelOutputLogged = false;

      async function ensureMicStream() {
        if (micStreamRef.current) return micStreamRef.current;

        appendLog("Requesting microphone access...");
        console.log("[LUMA] Requesting microphone access...");
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          micStreamRef.current = stream;
          console.log("[LUMA] Microphone stream acquired", stream);
          appendLog("Microphone access granted.");
          return stream;
        } catch (err) {
          console.error("[LUMA] getUserMedia error", err);
          appendLog("Microphone permission denied or failed.");
          setStatus("idle");
          throw err;
        }
      }

      async function attachMicrophoneTracks() {
        const stream = await ensureMicStream();
        const senders = pc.getSenders();

        stream.getAudioTracks().forEach((track) => {
          const alreadyAdded = senders.some((sender) => sender.track === track);
          if (!alreadyAdded) {
            pc.addTrack(track, stream);
          }
        });

        console.log("Microphone tracks attached to RTCPeerConnection");
        appendLog("Microphone connected to LUMA session.");
      }

      pc.ontrack = (event) => {
        if (!audioRef.current) return;
        audioRef.current.srcObject = event.streams[0];
        audioRef.current.autoplay = true;
        audioRef.current.setAttribute("playsinline", "true");
        const playPromise = audioRef.current.play();
        if (playPromise) {
          playPromise
            .then(() => {
              appendLog("Playing audio from LUMA.");
              if (!hasLoggedRemoteAudio) {
                console.log("First remote audio track received from LUMA");
                hasLoggedRemoteAudio = true;
              }
            })
            .catch((err) => {
              console.warn("Autoplay blocked or failed:", err);
            });
        }
      };

      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onopen = () => {
        appendLog("Data channel open. Configuring LUMA session...");
        console.log("Data channel opened");
        setStatus("active");
        startTimer();
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "session.created") {
            if (sessionInitializedRef.current) return;
            sessionInitializedRef.current = true;
            appendLog("Session created. Sending configuration and greeting...");
            console.log("Realtime session.created received");

            const contextLines: string[] = [
              `The candidate's name is "${candidateFullName}".`,
            ];

            if (nativeLanguage) {
              contextLines.push(
                `The candidate's native language is ${nativeLanguage}.`
              );
            }

            if (country) {
              contextLines.push(`The candidate is currently in ${country}.`);
            }

            if (testPurpose) {
              contextLines.push(`The purpose of this test is: ${testPurpose}.`);
            }

            const systemInstructions = [
              "You are LUMA, the Language Understanding Mastery Assistant of British Institutes. Speak clearly in English, be friendly and professional, and keep answers concise while evaluating the candidate's spoken English.",
              ...contextLines,
              "Keep the conversation flowing naturally and encourage the candidate to speak.",
            ].join("\n");

            const sessionUpdate = {
              type: "session.update",
              session: {
                model: REALTIME_MODEL,
                voice: "alloy",
                instructions: systemInstructions,
                turn_detection: {
                  type: "server_vad",
                  create_response: true,
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 500,
                },
                output_audio_format: "pcm16",
              },
            } as const;

            const greetingText =
              "Hi, I am LUMA, your AI speaking examiner. Tell me about yourself when you are ready.";

            const greetingEvent = {
              type: "response.create",
              response: {
                metadata: { purpose: "initial_greeting" },
                instructions: greetingText,
                modalities: ["text", "audio"],
                output_audio_format: "pcm16",
                voice: "alloy",
              },
            } as const;

            dc.send(JSON.stringify(sessionUpdate));
            dc.send(JSON.stringify(greetingEvent));
            console.log("Sent session.update and initial greeting to LUMA");
            appendLog("Session configured. LUMA will greet the candidate.");
            return;
          }

          if (
            msg.type === "response.output_audio_transcript.delta" ||
            msg.type === "input_audio_buffer.append" ||
            msg.type === "input_audio_buffer.speech_started" ||
            msg.type === "input_audio_buffer.speech_stopped" ||
            msg.type === "output_audio_buffer.delta"
          ) {
            return;
          }

          if (msg.type === "response.created" && msg.response?.id) {
            responseMetadataRef.current[msg.response.id] =
              msg.response.metadata?.purpose;
            appendLog("Response created: " + msg.response.id);
            return;
          }

          if (msg.type === "response.output_item.added") {
            appendLog("Output item added to response.");
            return;
          }

          if (msg.type === "response.text.delta") {
            const purpose = responseMetadataRef.current[msg.response_id];
            if (!firstModelOutputLogged) {
              console.log("Received first model output from LUMA");
              firstModelOutputLogged = true;
            }
            if (purpose === "speaking_report") {
              reportBufferRef.current += msg.delta;
            } else if (msg.delta?.trim()) {
              appendLog(`LUMA: ${msg.delta}`);
            }
            return;
          }

          if (msg.type === "response.text.done") {
            const purpose = responseMetadataRef.current[msg.response_id];
            if (purpose === "speaking_report") {
              const fullText = (reportBufferRef.current + msg.text).trim();
              reportBufferRef.current = "";
              if (!fullText) {
                appendLog("No written evaluation received from LUMA.");
                setStatus("active");
                return;
              }

              appendLog("Final written evaluation received from LUMA.");
              processFinalReport(fullText);
            } else if (msg.text?.trim()) {
              appendLog(`LUMA: ${msg.text}`);
            }
            return;
          }

          if (msg.type === "response.done") {
            appendLog("Response streaming completed.");
            return;
          }

          if (msg.type === "error") {
            console.error("LUMA Realtime error:", msg.error || msg);
            appendLog("ERROR from Realtime API: " + msg.error?.message);
            return;
          }

          if (msg.type) {
            appendLog("Event: " + msg.type);
          }
        } catch {
          // ignore non-JSON message
        }
      };

      const url =
        `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(REALTIME_MODEL)}` +
        `&client_secret=${encodeURIComponent(clientSecret)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      type RealtimeSignalMessage =
        | { type: "server_description"; sdp?: RTCSessionDescriptionInit }
        | { type: "ice_candidate"; candidate?: RTCIceCandidateInit }
        | { type: "error"; error?: { message?: string } }
        | { type?: string; [key: string]: any };

      ws.onerror = (event) => {
        console.error("Realtime WebSocket error:", event);
        appendLog("Realtime connection error.");
        setStatus("idle");
        stopTimer();
        stopMicrophoneTracks();
      };

      ws.onclose = () => {
        setStatus((prev) => {
          if (prev !== "idle") {
            appendLog("Realtime connection closed.");
            stopTimer();
            stopMicrophoneTracks();
          }
          return "idle";
        });
      };

      pc.onicecandidate = (event) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          return;
        }
        if (event.candidate) {
          wsRef.current.send(
            JSON.stringify({
              type: "ice_candidate",
              candidate: event.candidate,
            })
          );
        } else {
          wsRef.current.send(JSON.stringify({ type: "ice_candidate_complete" }));
        }
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data) as RealtimeSignalMessage;
          if (message.type === "server_description" && message.sdp) {
            await pc.setRemoteDescription(message.sdp);
            appendLog("Received remote description from LUMA.");
          } else if (message.type === "ice_candidate" && message.candidate) {
            await pc.addIceCandidate(message.candidate);
          } else if (message.type === "error") {
            console.error("Realtime error:", message.error || message);
            appendLog(
              "Error from Realtime API: " + (message.error?.message || "unknown")
            );
            setStatus("idle");
            stopTimer();
            stopMicrophoneTracks();
          }
        } catch (error) {
          console.error("Failed to parse signaling message:", error);
        }
      };

      const sendClientDescription = () => {
        if (
          ws.readyState === WebSocket.OPEN &&
          pc.localDescription?.sdp &&
          pc.localDescription?.type
        ) {
          ws.send(
            JSON.stringify({
              type: "client_description",
              sdp: pc.localDescription,
            })
          );
          appendLog("Sent SDP offer to OpenAI Realtime API.");
        }
      };

      const createAndSendOffer = async () => {
        await attachMicrophoneTracks();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendClientDescription();
      };

      ws.onopen = async () => {
        console.log("[LUMA] Realtime WebSocket opened");
        appendLog("Realtime WebSocket opened.");
        setStatus("active");
        startTimer();
        try {
          await createAndSendOffer();
        } catch (error: any) {
          console.error("Failed to start signaling", error);
          appendLog("Failed to start signaling: " + (error?.message || "unknown"));
          setStatus("idle");
          stopTimer();
        }
      };

      appendLog("Connecting to LUMA Realtime...");
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
    appendLog("Requesting final written evaluation from LUMA...");
    reportBufferRef.current = "";

    const instructions =
      "Now, as LUMA, produce ONLY a structured JSON evaluation of the candidate's English speaking performance. " +
      "Do NOT speak this aloud, only return JSON. " +
      "Use this exact schema: " +
      '{ "candidate_name": string | null, "cefr_level": string, "accent": string, "strengths": string[], "weaknesses": string[], "recommendations": string[], "overall_comment": string }.';

    const event = {
      type: "response.create",
      response: {
        instructions,
        metadata: {
          purpose: "speaking_report",
        },
        modalities: ["text"],
      },
    };

    dc.send(JSON.stringify(event));
  }

  async function processFinalReport(text: string) {
    const trimmed = text.trim();
    let parsed: ReportState["parsed"] | undefined;

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      parsed = undefined;
    }

    setReport({ rawText: trimmed, parsed });

    if (!candidateId) {
      appendLog("Missing candidate ID; unable to store report.");
      setStatus("active");
      return;
    }

    const payload = {
      candidateId,
      rawEvaluationText: trimmed,
      rawEvaluationJson: parsed,
    };

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
        const saved = await resp.json();
        if (saved.report) {
          setReport({ rawText: trimmed, parsed: saved.report });
        }
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
    stopMicrophoneTracks();
    requestFinalEvaluation();
  }

  function hardCloseSession() {
    peerRef.current?.close();
    peerRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    sessionInitializedRef.current = false;
    stopMicrophoneTracks();
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
      {/* background */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        <div className="absolute -left-16 -top-24 h-72 w-72 rounded-full bg-sky-500/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="absolute -right-20 top-10 h-72 w-72 rounded-full bg-teal-400/25 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-12 space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-sky-100 ring-1 ring-white/15">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          British Institutes · Speaking Examiner
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          {/* left column */}
          <div className="flex flex-col gap-6">
            {/* header + form */}
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-indigo-900/50 backdrop-blur">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <h1 className="text-4xl font-black leading-tight sm:text-5xl">
                    LUMA Speaking Test
                  </h1>
                  <p className="max-w-2xl text-sm leading-relaxed text-slate-200">
                    Register the candidate, start the live conversation, and let
                    LUMA score pronunciation, rhythm, and coherence in real
                    time.
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

                {/* LUMA GIF listening field */}
                <div className="relative w-full max-w-xs self-center overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-2 shadow-xl shadow-indigo-900/50">
                  <div className="relative h-40 w-full overflow-hidden rounded-xl bg-black">
                    <img
                      src="/Luma-project.gif"
                      alt="LUMA listening animation"
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50" />
                  </div>
                  <p className="relative mt-3 text-center text-[11px] text-slate-200">
                    LUMA listening field
                  </p>
                </div>
              </div>

              {/* form fields */}
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
                    type="email"
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-1 ring-transparent transition focus:border-sky-400/60 focus:ring-sky-500/40"
                    placeholder="candidate@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!isIdle}
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
                <SearchableSelect
                  label="Native language"
                  value={nativeLanguage}
                  onChange={setNativeLanguage}
                  options={NATIVE_LANGUAGES}
                  placeholder="Select or type your native language"
                  required
                  disabled={!isIdle}
                />
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
                <SearchableSelect
                  label="Purpose of the test"
                  value={testPurpose}
                  onChange={setTestPurpose}
                  options={TEST_PURPOSES}
                  placeholder="Select or type the purpose of your test"
                  required
                  disabled={!isIdle}
                />

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

            {/* controls */}
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
                    <p className="text-slate-300">
                      Keep this tab active. LUMA speaks only in English.
                    </p>
                  </div>
                  <audio ref={audioRef} className="hidden" />
                </div>
              </div>
            </section>
          </div>

          {/* right column */}
          <aside className="flex flex-col gap-6">
            <div className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-2xl shadow-indigo-900/40 backdrop-blur">
              <h3 className="text-sm font-semibold text-sky-200">Candidate</h3>
              <p className="mt-1 text-base font-semibold text-white">
                {candidateFullName || "—"}{" "}
                {email && <span className="text-slate-400">({email})</span>}
              </p>

              <h3 className="mb-1 mt-4 text-xs font-semibold text-slate-300">
                Tips for best results
              </h3>
              <ul className="space-y-1 text-[12px] text-slate-300">
                <li>• Use headphones and a clear microphone.</li>
                <li>• Answer in full sentences, not single words.</li>
                <li>
                  • Imagine you are in an official British Institutes speaking
                  exam.
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/5 p-5 text-sm text-slate-100 shadow-2xl shadow-indigo-900/40 backdrop-blur">
              <h2 className="mb-2 text-sm font-semibold text-sky-200">
                Final speaking report
              </h2>

              {!report && (
                <p className="text-[12px] text-slate-300">
                  After you press{" "}
                  <span className="font-semibold text-white">Stop</span>, LUMA
                  will generate a structured written evaluation of the
                  candidate&apos;s speaking performance.
                </p>
              )}

              {report && (
                <div className="space-y-3 text-[12px]">
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
                    <p className="text-slate-300">
                      The evaluation is being structured. Please try again if
                      it does not appear shortly.
                    </p>
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
