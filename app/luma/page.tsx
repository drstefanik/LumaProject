"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole,
} from "@floating-ui/react";

type Status = "idle" | "connecting" | "active" | "evaluating";

const REALTIME_MODEL =
  process.env.NEXT_PUBLIC_REALTIME_MODEL ?? "gpt-realtime";

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
    global_score?: number;
  };
  formatted?: string;
  airtableId?: string | null;
  meta?: { cefrLevel?: string | null; globalScore?: number | null };
};

const NATIVE_LANGUAGES = [
  "Afar",
  "Abkhazian",
  "Avestan",
  "Afrikaans",
  "Akan",
  "Amharic",
  "Aragonese",
  "Arabic",
  "Assamese",
  "Avaric",
  "Aymara",
  "Azerbaijani",
  "Bashkir",
  "Belarusian",
  "Bulgarian",
  "Bihari languages",
  "Bislama",
  "Bambara",
  "Bengali",
  "Tibetan",
  "Breton",
  "Bosnian",
  "Catalan",
  "Chechen",
  "Chamorro",
  "Corsican",
  "Cree",
  "Czech",
  "Church Slavic",
  "Chuvash",
  "Welsh",
  "Danish",
  "German",
  "Divehi (Dhivehi)",
  "Dzongkha",
  "Ewe",
  "Greek (Modern)",
  "English",
  "Esperanto",
  "Spanish",
  "Estonian",
  "Basque",
  "Persian (Farsi)",
  "Fulah",
  "Finnish",
  "Fijian",
  "Faroese",
  "French",
  "Western Frisian",
  "Irish",
  "Scottish Gaelic",
  "Galician",
  "Guarani",
  "Gujarati",
  "Manx",
  "Hausa",
  "Hebrew (Modern)",
  "Hindi",
  "Hiri Motu",
  "Croatian",
  "Haitian Creole",
  "Hungarian",
  "Armenian",
  "Herero",
  "Interlingua",
  "Indonesian",
  "Interlingue",
  "Igbo",
  "Sichuan Yi",
  "Inupiaq",
  "Ido",
  "Icelandic",
  "Italian",
  "Inuktitut",
  "Japanese",
  "Javanese",
  "Georgian",
  "Kongo",
  "Kikuyu",
  "Kuanyama",
  "Kazakh",
  "Kalaallisut",
  "Khmer",
  "Kannada",
  "Korean",
  "Kanuri",
  "Kashmiri",
  "Kurdish",
  "Komi",
  "Cornish",
  "Kirghiz (Kyrgyz)",
  "Latin",
  "Luxembourgish",
  "Ganda",
  "Limburgish",
  "Lingala",
  "Lao",
  "Lithuanian",
  "Luba-Katanga",
  "Latvian",
  "Malagasy",
  "Marshallese",
  "Maori",
  "Macedonian",
  "Malayalam",
  "Mongolian",
  "Marathi",
  "Malay",
  "Maltese",
  "Burmese",
  "Nauru",
  "Norwegian Bokmål",
  "North Ndebele",
  "Nepali",
  "Ndonga",
  "Dutch",
  "Norwegian Nynorsk",
  "Norwegian (Generic)",
  "South Ndebele",
  "Navajo",
  "Chichewa (Nyanja)",
  "Occitan",
  "Ojibwa",
  "Oromo",
  "Oriya",
  "Ossetian",
  "Panjabi (Punjabi)",
  "Pali",
  "Polish",
  "Pashto",
  "Portuguese",
  "Quechua",
  "Romansh",
  "Rundi",
  "Romanian",
  "Russian",
  "Kinyarwanda",
  "Sanskrit",
  "Sardinian",
  "Sindhi",
  "Northern Sami",
  "Sango",
  "Sinhalese",
  "Slovak",
  "Slovenian",
  "Samoan",
  "Shona",
  "Somali",
  "Albanian",
  "Serbian",
  "Swati",
  "Sotho (Southern)",
  "Sundanese",
  "Swedish",
  "Swahili",
  "Tamil",
  "Telugu",
  "Tajik",
  "Thai",
  "Tigrinya",
  "Turkmen",
  "Tagalog (Filipino)",
  "Tswana",
  "Tongan",
  "Turkish",
  "Tsonga",
  "Tatar",
  "Twi",
  "Tahitian",
  "Uighur",
  "Ukrainian",
  "Urdu",
  "Uzbek",
  "Venda",
  "Vietnamese",
  "Volapük",
  "Walloon",
  "Wolof",
  "Xhosa",
  "Yiddish",
  "Yoruba",
  "Zhuang",
  "Chinese (Mandarin)",
  "Zulu",
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
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(0);

  const listRef = useRef<Array<HTMLButtonElement | null>>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filteredOptions = useMemo(() => {
    const q = query.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) return;
    // reset highlight quando cambia lista
    setHighlightedIndex(filteredOptions.length ? 0 : null);
  }, [isOpen, filteredOptions.length]);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (disabled) return;
      setIsOpen(open);
    },
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({ padding: 10 }), // se non c'è spazio sotto -> sopra
      shift({ padding: 10 }), // evita che esca lateralmente
      size({
        padding: 10,
        apply({ rects, availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
            maxHeight: `${Math.min(availableHeight, 220)}px`, // ~ max-h-52
          });
        },
      }),
    ],
  });

  // a11y + click outside/esc
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "listbox" });

  // keyboard navigation
  const listNav = useListNavigation(context, {
    listRef,
    activeIndex: highlightedIndex ?? 0,
    onNavigate: setHighlightedIndex,
    loop: true,
    virtual: true,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    dismiss,
    role,
    listNav,
  ]);

  function handleSelect(option: string) {
    setQuery(option);
    onChange(option);
    setIsOpen(false);
    // mantiene focus sull'input
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    setQuery(newValue);
    onChange(newValue);
    if (!disabled) setIsOpen(true);
  }

  function handleKeyDown(e: KeyboardEvent<Element>) {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => {
        const i = prev ?? -1;
        return filteredOptions.length ? (i + 1) % filteredOptions.length : null;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => {
        const i = prev ?? 0;
        return filteredOptions.length
          ? (i - 1 + filteredOptions.length) % filteredOptions.length
          : null;
      });
    } else if (e.key === "Enter" && isOpen && filteredOptions.length) {
      e.preventDefault();
      const idx = highlightedIndex ?? 0;
      const opt = filteredOptions[idx];
      if (opt) handleSelect(opt);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  const showMenu = isOpen && filteredOptions.length > 0;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
        {required ? " *" : ""}
      </label>

      <div className="relative">
        <input
  ref={(node) => {
    inputRef.current = node;
    refs.setReference(node);
  }}
  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-1 ring-transparent transition focus:border-sky-400/60 focus:ring-sky-500/40"
  placeholder={placeholder}
  value={query}
  onChange={handleInputChange}
  disabled={disabled}
  autoComplete="off"
  {...getReferenceProps({
    onFocus: () => {
      if (disabled) return;
      setIsOpen(true);
    },
    onClick: () => {
      if (disabled) return;
      setIsOpen(true);
    },
    onKeyDown: (e) => {
      handleKeyDown(e);
    },
  })}
/>


        {showMenu &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              className="z-[9999] overflow-hidden rounded-lg border border-white/10 bg-slate-900/95 shadow-lg shadow-black/50 backdrop-blur"
              {...getFloatingProps()}
            >
              <ul className="overflow-y-auto text-xs text-slate-100">
                {filteredOptions.map((option, idx) => (
                  <li key={option}>
                    <button
                      ref={(node) => {
                        listRef.current[idx] = node;
                      }}
                      type="button"
                      className={`flex w-full items-start px-3 py-2 text-left transition hover:bg-white/10 ${
                        idx === (highlightedIndex ?? 0) ? "bg-white/10" : ""
                      }`}
                      onMouseDown={(e) => e.preventDefault()} // evita blur input
                      onClick={() => handleSelect(option)}
                    >
                      {option}
                    </button>
                  </li>
                ))}
              </ul>
            </div>,
            document.body
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
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
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
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const responseMetadataRef = useRef<Record<string, string | undefined>>({});
  const isModelSpeakingRef = useRef(false);

  const statusRef = useRef<Status>("idle");

  const reportResponseIdRef = useRef<string | null>(null);
  const evaluationBufferRef = useRef<string>("");

  const candidateFullName = `${firstName} ${lastName}`.trim();

  function appendLog(msg: string) {
    console.log(`[LUMA] ${msg}`);
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
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!audioRef.current) return;
    // durante la valutazione niente audio (non deve leggere il report)
    audioRef.current.muted = status === "evaluating";
  }, [status]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.autoplay = true;
      audioRef.current.setAttribute("playsinline", "true");
    }

    return () => {
      peerRef.current?.close();
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

      if (statusRef.current !== "idle") {
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

      // reset connessione precedente
      peerRef.current?.close();
      peerRef.current = null;
      dataChannelRef.current?.close();
      dataChannelRef.current = null;

      setReport(null);
      setCandidateId(null);
      evaluationBufferRef.current = "";
      responseMetadataRef.current = {};
      reportResponseIdRef.current = null;
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
      const backendCandidateId = (candidateJson.candidateId ||
        candidateJson.recordId) as string | undefined;

      if (!backendCandidateId) {
        appendLog("Candidate registration failed: missing candidateId.");
        setStatus("idle");
        return;
      }

      setCandidateId(backendCandidateId);
      console.log("[LUMA] Candidate saved");
      appendLog("Requesting client secret from backend...");

      const res = await fetch("/api/voice/client-secret", {
        method: "POST",
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

      appendLog("Requesting microphone access...");
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        micStreamRef.current = stream;
        appendLog("Microphone access granted.");
      } catch (err) {
        appendLog("Microphone permission denied or failed.");
        setStatus("idle");
        alert(
          "Microphone access denied. Please enable microphone access and try again."
        );
        return;
      }

      const pc = new RTCPeerConnection();
      peerRef.current = pc;

      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

      let hasLoggedRemoteAudio = false;
      let firstModelOutputLogged = false;

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

      const sessionInstructions = (() => {
        const contextLines: string[] = [
          `The candidate's name is "${candidateFullName}".`,
        ];

        if (nativeLanguage) {
          contextLines.push(`The candidate's native language is ${nativeLanguage}.`);
        }

        if (country) {
          contextLines.push(`The candidate is currently in ${country}.`);
        }

        if (testPurpose) {
          contextLines.push(`The purpose of this test is: ${testPurpose}.`);
        }

        return [
          "You are LUMA, the official speaking examiner for British Institutes.",
          "Your role is EXAMINER ONLY: you MUST NOT act as a tutor, coach, or conversation partner.",
          "Do NOT teach, correct, drill, or propose practice activities. Do NOT say things like 'let me help you', 'let's practice', or 'how can I assist you today'.",
          "This is a formal A1–C2 speaking test. You lead the test with exam-style questions in English only.",
          "Structure the test in three short parts: (1) warm-up about personal background, (2) questions about study/work/daily life, (3) slightly extended questions about plans, opinions or experiences.",
          "Ask clear, simple questions and short follow-up questions. Give the candidate most of the talking time.",
          "VERY IMPORTANT: During the test you must NEVER give feedback, advice, or an opinion about the candidate's level or performance.",
          "Never mention CEFR levels, scores, 'beginner/intermediate/advanced', accent quality, or how well they did.",
          "If the candidate asks for feedback or a score, reply briefly: 'I’m not allowed to give feedback during the test. The result will be provided separately.' and then continue with the next exam question.",
          "You will later be asked by the system to produce a JSON evaluation. Do NOT talk about this with the candidate.",
          "You must always speak in English.",
          ...contextLines,
          "Keep the conversation flowing naturally and encourage the candidate to answer in full sentences.",
        ].join("\n");
      })();

      dc.onopen = () => {
        appendLog("Data channel open. Configuring LUMA session...");
        setStatus("active");
        startTimer();

        const sessionUpdate = {
          type: "session.update",
          session: {
            type: "realtime",
            model: REALTIME_MODEL,
            instructions: sessionInstructions,
            // VAD meno sensibile per non tagliare le domande
            turn_detection: {
              type: "server",
              threshold: 0.6,
              silence_ms: 1600,
            },
          },
        } as const;

        const greetingEvent = {
          type: "response.create",
          response: {
            metadata: { purpose: "initial_greeting" },
            instructions:
              "Start the speaking exam now. Use ONLY English. " +
              "Use a formal, examiner-like tone. " +
              "Do NOT say 'How can I help you?', 'How can I assist you?', 'What would you like to practice?' or anything similar. " +
              "Follow this exact script:\n" +
              "1) Greet the candidate: 'Good afternoon. My name is LUMA and I will be your speaking examiner today.'\n" +
              "2) Ask: 'Could you tell me your full name, please?'\n" +
              "3) After the answer, ask: 'Thank you. Could you spell your family name, please?'\n" +
              "4) Then ask: 'Do you work, or are you a student?'\n" +
              "5) Depending on the answer, ask 2 or 3 short follow-up questions about their job or studies and then continue with everyday topics as described in the session instructions.",
          },
        } as const;

        dc.send(JSON.stringify(sessionUpdate));
        dc.send(JSON.stringify(greetingEvent));
      };

      dc.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data as string);

          if (statusRef.current === "evaluating") {
            console.log("[LUMA evaluating] event:", message);
          }

          if (message.type === "error") {
            console.error("[LUMA realtime error]", message.error || message);
            appendLog(
              "Realtime error: " +
                (message.error?.message ||
                  JSON.stringify(message.error || message))
            );
            setStatus("active");
            return;
          }

          if (
            message.type === "input_audio_buffer.append" ||
            message.type === "input_audio_buffer.speech_started" ||
            message.type === "input_audio_buffer.speech_stopped" ||
            message.type === "output_audio_buffer.delta"
          ) {
            return;
          }

          if (message.type?.startsWith("output_audio_buffer.")) {
            if (message.type === "output_audio_buffer.started") {
              isModelSpeakingRef.current = true;
            }
            if (
              message.type === "output_audio_buffer.stopped" ||
              message.type === "output_audio_buffer.done"
            ) {
              isModelSpeakingRef.current = false;
            }
            return;
          }

          if (message.type === "response.created" && message.response?.id) {
            const purpose = message.response.metadata?.purpose as
              | string
              | undefined;

            responseMetadataRef.current[message.response.id] = purpose;

            if (purpose === "speaking_report") {
              reportResponseIdRef.current = message.response.id;
              evaluationBufferRef.current = "";
              appendLog(
                "Started receiving speaking_report response: " +
                  message.response.id
              );
            } else {
              appendLog("Response created: " + message.response.id);
            }
            return;
          }

          if (message.type === "response.output_item.added") {
            const responseId =
              message.item?.response_id ?? message.response_id;
            const itemPurpose =
              message.item?.metadata?.purpose ??
              message.response?.metadata?.purpose;

            if (itemPurpose === "speaking_report" && responseId) {
              reportResponseIdRef.current = responseId;
              evaluationBufferRef.current = "";
              appendLog(
                "Started receiving speaking_report response: " + responseId
              );
              return;
            }

            appendLog("Output item added to response.");
            return;
          }

          const relevantResponseId =
            message.response_id ??
            message.response?.id ??
            message.item?.response_id;

          const isReportResponse =
            !!reportResponseIdRef.current &&
            relevantResponseId === reportResponseIdRef.current;

          const isEvaluatingReport =
            statusRef.current === "evaluating" && isReportResponse;

          if (
            isEvaluatingReport &&
            (message.type === "response.output_text.delta" ||
              message.type === "response.output_text.append" ||
              message.type === "response.output_audio_transcript.delta" ||
              message.type === "response.output_audio_transcript.append" ||
              message.type === "response.content_part.added" ||
              message.type === "response.text.delta" ||
              message.type === "response.output_item.delta")
          ) {
            let chunk = "";

            if (typeof message.delta === "string") {
              chunk = message.delta;
            } else if (typeof message.text === "string") {
              chunk = message.text;
            } else if (
              Array.isArray(message.content) &&
              typeof message.content?.[0]?.text === "string"
            ) {
              chunk = message.content[0].text;
            } else if (typeof message.part?.text === "string") {
              chunk = message.part.text;
            }

            if (chunk) {
              evaluationBufferRef.current += chunk;
              appendLog(
                "Accumulated report length: " +
                  evaluationBufferRef.current.length
              );
            }
            return;
          }

          if (message.type === "response.done") {
            const isEvalDone =
              statusRef.current === "evaluating" && isReportResponse;

            if (isEvalDone) {
              appendLog(
                "Speaking report completed (response.done). Calling processFinalReport..."
              );
              const fullText = evaluationBufferRef.current.trim();
              evaluationBufferRef.current = "";
              reportResponseIdRef.current = null;
              await processFinalReport(fullText);
            } else {
              appendLog("Response finished.");
            }
            return;
          }

          if (message.type === "response.text.delta") {
            const purpose = responseMetadataRef.current[message.response_id];
            if (!firstModelOutputLogged) {
              console.log("Received first model output from LUMA");
              firstModelOutputLogged = true;
            }
            if (purpose === "speaking_report") {
              evaluationBufferRef.current += message.delta;
            } else if (message.delta?.trim()) {
              appendLog(`LUMA: ${message.delta}`);
            }
            return;
          }

          if (message.type === "response.text.done") {
            const purpose = responseMetadataRef.current[message.response_id];
            if (purpose === "speaking_report") {
              evaluationBufferRef.current += message.text ?? "";
            } else if (message.text?.trim()) {
              appendLog(`LUMA: ${message.text}`);
            }
            return;
          }

          appendLog(`Event: ${message.type}`);
        } catch (err: any) {
          console.error("Error parsing data channel message", err);
        }
      };

      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      appendLog("Sending SDP offer to OpenAI Realtime API...");
      const callRes = await fetch(
        "https://api.openai.com/v1/realtime/calls?model=gpt-realtime",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${clientSecret}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp ?? "",
        }
      );

      if (!callRes.ok) {
        const errorText = await callRes.text();
        appendLog("Failed to start realtime call: " + errorText);
        setStatus("idle");
        stopTimer();
        return;
      }

      const answerSdp = await callRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      appendLog("Realtime session active.");
    } catch (err: any) {
      console.error(err);
      appendLog("Error: " + (err?.message || "unknown"));
      setStatus("idle");
      stopTimer();
    }
  }

  function requestFinalEvaluation() {
    appendLog("requestFinalEvaluation called.");
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== "open") {
      appendLog("Data channel not open. Cannot request evaluation.");
      return;
    }

    if (audioRef.current) {
      audioRef.current.muted = true;
    }

    setStatus("evaluating");
    evaluationBufferRef.current = "";
    reportResponseIdRef.current = null;
    appendLog("Requesting final written evaluation from LUMA...");

    const instructions =
      "You are an English speaking examiner. " +
      "The user has just completed a speaking test. " +
      "Based ONLY on the conversation so far, return a single JSON object describing their speaking performance. " +
      "You must NOT produce any spoken feedback, summary, or explanation for the candidate. " +
      "You are writing for the examiner's backend system only, not for the candidate. " +
      "Return ONLY valid JSON, with no extra text, using this exact schema: " +
      '{ "candidate_name": string | null, "cefr_level": string, "accent": string, "strengths": string[], "weaknesses": string[], "recommendations": string[], "overall_comment": string }.';

    const event = {
      type: "response.create",
      response: {
        instructions,
        metadata: {
          purpose: "speaking_report",
        },
      },
    };

    dc.send(JSON.stringify(event));
    appendLog("Evaluation request event sent.");
  }

  async function submitReport(finalReport: ReportState) {
    setIsSubmittingReport(true);
    appendLog("submitReport called. Sending POST /api/report ...");
    appendLog("Submitting evaluation to /api/report...");

    const payload = {
      candidate: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        dateOfBirth: birthDate,
        nativeLanguage: nativeLanguage.trim(),
        country: country.trim(),
        testPurpose: testPurpose.trim(),
        consentPrivacy: privacyAccepted,
      },
      evaluation: {
        rawJson: finalReport.rawText,
        parsed: finalReport.parsed,
      },
    };

    console.log("[LUMA] evaluation.rawJson:", payload.evaluation.rawJson);

    try {
      const resp = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        appendLog("Error saving report: " + text);
        alert("Failed to generate the final report. Please try again.");
        return;
      }

      const saved = await resp.json();
      setReport((prev) => ({
        ...(prev || finalReport),
        formatted: saved.reportText,
        meta: saved.meta,
        airtableId: saved.airtableId ?? null,
      }));
      appendLog("Report saved and formatted.");
    } catch (e: any) {
      appendLog(
        "Network error while saving report: " + (e?.message || "unknown")
      );
      alert("Network error while generating the report. Please try again.");
    } finally {
      setIsSubmittingReport(false);
      setStatus("active");
    }
  }

  async function processFinalReport(text: string) {
    const trimmed = text.trim();
    appendLog("processFinalReport called. Raw length: " + trimmed.length);
    console.log("[LUMA] Raw evaluation text:", trimmed);

    if (!trimmed) {
      appendLog("No written evaluation received from LUMA.");
      setStatus("active");
      return;
    }

    let parsed: ReportState["parsed"] | undefined;

    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      console.warn("[LUMA] Failed to parse evaluation JSON", error);
      appendLog("Invalid evaluation JSON received. Sending raw text only.");
    }

    console.log("[LUMA] Parsed evaluation object:", parsed);

    const finalParsedReport: ReportState = {
      rawText: trimmed,
      parsed: parsed || undefined,
    };
    setReport(finalParsedReport);
    await submitReport(finalParsedReport);
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
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
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

      <div className="relative mx-auto max-w-6xl space-y-8 px-6 py-12">
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
                    Date of birth *
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
                    Country *
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
                      Keep this tab active. LUMA speaks only in English. Ask the
                      candidate to say “Hello” when ready, and click{" "}
                      <span className="font-semibold">Stop</span> when you
                      decide the test is finished.
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
                  will silently generate a structured written evaluation of the
                  candidate&apos;s speaking performance (no spoken feedback).
                </p>
              )}

              {isSubmittingReport && (
                <p className="text-[12px] text-slate-300">
                  Generating the final formatted report...
                </p>
              )}

              {report && (
                <div className="space-y-4 text-[12px]">
                  {report.formatted && (
                    <div className="space-y-2 rounded-2xl border border-white/10 bg-black/40 p-4 text-left text-sm leading-relaxed text-slate-100">
                      {report.formatted
                        .split(/\n{2,}/)
                        .map((paragraph, idx) => (
                          <p key={idx}>{paragraph.trim()}</p>
                        ))}
                    </div>
                  )}

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
                      The evaluation is being structured. Please try again if it
                      does not appear shortly.
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
