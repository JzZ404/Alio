"use client";

import { useState, useRef } from "react";
import { api, ApiError } from "@/lib/api";

type State = "idle" | "recording" | "transcribing" | "reviewing" | "submitting" | "done";

function WaveformIcon({ active }: { active: boolean }) {
  if (!active) {
    return (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#1A1A2E" strokeWidth="2">
        <rect x="9" y="2" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0014 0" strokeLinecap="round" />
        <line x1="12" y1="18" x2="12" y2="22" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <div className="flex items-center gap-[3px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="wave-bar rounded-full bg-[#1A1A2E]"
          style={{ width: 3, minHeight: 4, display: "inline-block" }}
        />
      ))}
    </div>
  );
}

export default function CaregiverAI() {
  const [state, setState] = useState<State>("idle");
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [transcribeWarning, setTranscribeWarning] = useState("");
  const [editingTranscript, setEditingTranscript] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const busy = state === "recording" || state === "transcribing" || state === "submitting";
  const canSubmit = (transcript.trim() !== "" || notes.trim() !== "") && !busy;

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = handleRecordingStop;
      recorder.start();
      recorderRef.current = recorder;
      setState("recording");
    } catch {
      setError("Microphone access denied. Use the notes field instead.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    setState("transcribing");
  }

  async function handleRecordingStop() {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    try {
      const { transcript: t } = await api.transcribe(blob);
      setTranscript(t);
      setTranscribeWarning("");
      setState("reviewing");
    } catch {
      setTranscribeWarning(
        "Could not transcribe — add written notes to continue."
      );
      setState("reviewing");
    }
  }

  async function handleSubmit() {
    setState("submitting");
    setError("");
    try {
      const { name } = await api.getPatient();
      const result = await api.summarize(name, transcript, notes.trim());
      await api.saveReport(result);
      setState("done");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not generate report.");
      setState("idle");
    }
  }

  function reset() {
    setState("idle");
    setTranscript("");
    setNotes("");
    setError("");
    setTranscribeWarning("");
    setEditingTranscript(false);
  }

  /* ── Done state ── */
  if (state === "done") {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-5">
        <div className="w-20 h-20 rounded-full bg-[#E8FFF0] flex items-center justify-center text-4xl">
          ✓
        </div>
        <h2 className="text-[22px] font-bold text-[#1A1A2E]">Report Submitted!</h2>
        <p className="text-[#9898B4] text-sm leading-relaxed">
          Janet has been notified with an AI summary of today&#39;s visit.
        </p>
        <button
          onClick={reset}
          className="mt-2 py-3 px-8 rounded-2xl text-white font-semibold text-[15px]"
          style={{ background: "#5654FF" }}
        >
          Log Another Visit
        </button>
      </div>
    );
  }

  /* ── Recording / reviewing state ── */
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-2">
        <div className="text-center flex-1">
          <p className="text-[11px] text-[#9898B4] font-medium tracking-wide">
            You are logging
          </p>
          <button className="flex items-center gap-1.5 mx-auto">
            <span className="text-[18px] font-bold text-[#1A1A2E]">Sarah</span>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#9898B4" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
        <button className="absolute right-5 top-12 w-9 h-9 rounded-full bg-[#F0F0FA] flex items-center justify-center">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#9898B4" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-start px-5 overflow-y-auto no-scrollbar">

        {/* Listening screen */}
        {state === "idle" || state === "recording" || state === "transcribing" ? (
          <div className="flex flex-col items-center justify-center flex-1 w-full">
            <p className="text-[#1A1A2E] text-[21px] font-semibold mb-8 text-center">
              {state === "recording"
                ? "Listening…"
                : state === "transcribing"
                ? "Transcribing…"
                : "Hi, I am listening"}
            </p>

            {/* Gradient blob */}
            <div className="relative w-56 h-56 flex items-center justify-center mb-8">
              <div
                className="blob-3 absolute rounded-full"
                style={{
                  width: 210,
                  height: 210,
                  background:
                    "radial-gradient(circle at 35% 30%, #FFCCE0 0%, #E8C8FF 45%, #F0E8FF 100%)",
                  opacity: 0.45,
                }}
              />
              <div
                className="blob-2 absolute rounded-full"
                style={{
                  width: 168,
                  height: 168,
                  background:
                    "radial-gradient(circle at 55% 40%, #C0BCFF 0%, #D8C8FF 55%, transparent 100%)",
                  opacity: 0.62,
                }}
              />
              <div
                className="blob-1 absolute rounded-full"
                style={{
                  width: 124,
                  height: 124,
                  background:
                    "radial-gradient(circle at 45% 38%, #9898FF 0%, #BCB8FF 55%, #DACAFF 100%)",
                  opacity: 0.82,
                }}
              />
              {state === "recording" && (
                <div className="relative z-10 flex items-center gap-[5px]">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="wave-bar rounded-full bg-white"
                      style={{ width: 4, minHeight: 4, display: "inline-block" }}
                    />
                  ))}
                </div>
              )}
              {state === "transcribing" && (
                <div className="relative z-10 flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:0.3s]" />
                </div>
              )}
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center px-6">{error}</p>
            )}
          </div>
        ) : (
          /* Review screen */
          <div className="flex flex-col gap-4 w-full pt-4">
            {transcribeWarning && (
              <div className="bg-yellow-50 text-yellow-700 text-sm px-4 py-3 rounded-xl">
                {transcribeWarning}
              </div>
            )}

            {transcript && (
              <div className="bg-white rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-[#9898B4] uppercase tracking-wide">
                    Transcription
                  </p>
                  <button
                    onClick={() => setEditingTranscript(!editingTranscript)}
                    className="text-[12px] text-[#5654FF] font-medium"
                  >
                    {editingTranscript ? "Done" : "Edit"}
                  </button>
                </div>
                {editingTranscript ? (
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    rows={4}
                    className="w-full text-sm text-[#1A1A2E] resize-none outline-none leading-relaxed"
                    autoFocus
                  />
                ) : (
                  <p className="text-sm text-[#1A1A2E] leading-relaxed">{transcript}</p>
                )}
              </div>
            )}

            <div className="bg-white rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-[#9898B4] uppercase tracking-wide mb-2">
                Additional Notes
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={busy}
                placeholder="Any observations to add…"
                className="w-full text-sm text-[#1A1A2E] resize-none outline-none leading-relaxed placeholder:text-[#C4C4D4]"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm px-1">{error}</p>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="px-4 pb-4 pt-2">
        {state === "reviewing" || state === "submitting" ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-3.5 rounded-2xl text-white font-semibold text-[15px] disabled:opacity-40 transition-opacity"
              style={{ background: canSubmit ? "#5654FF" : "#9898B4" }}
            >
              {state === "submitting" ? "Submitting…" : "Submit Report"}
            </button>
            <button
              onClick={reset}
              className="w-full py-3 rounded-2xl text-[#9898B4] font-medium text-[14px] bg-white"
            >
              Discard &amp; Re-record
            </button>
          </div>
        ) : (
          <div
            className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
          >
            {/* Keyboard icon */}
            <button
              onClick={() => setState("reviewing")}
              className="w-9 h-9 rounded-xl bg-[#F0F0FA] flex items-center justify-center flex-shrink-0"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#9898B4" strokeWidth="1.8">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12" strokeLinecap="round" />
              </svg>
            </button>

            {/* Press to Speak / Stop */}
            {state === "recording" ? (
              <button
                onClick={stopRecording}
                className="flex-1 rounded-xl py-2.5 flex items-center justify-center gap-2 font-semibold text-[#1A1A2E] text-[15px]"
                style={{ background: "#FF6B6B", color: "white" }}
              >
                <span className="w-3 h-3 rounded-sm bg-white" />
                Stop Recording
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={busy}
                className="flex-1 rounded-xl py-2.5 flex items-center justify-center gap-2 font-semibold text-[#1A1A2E] text-[15px] disabled:opacity-50"
                style={{ background: "#D5FF2C" }}
              >
                <WaveformIcon active={false} />
                {state === "transcribing" ? "Transcribing…" : "Press to Speak"}
              </button>
            )}

            {/* + button */}
            <button
              onClick={() => setState("reviewing")}
              className="w-9 h-9 rounded-xl bg-[#F0F0FA] flex items-center justify-center flex-shrink-0 text-[#9898B4] text-xl font-light"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
