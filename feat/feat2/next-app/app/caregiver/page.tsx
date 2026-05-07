"use client";

import { useState, useRef } from "react";
import { api, ApiError } from "@/lib/api";

type State = "idle" | "recording" | "transcribing" | "submitting" | "done";

export default function CaregiverPage() {
  const [state, setState] = useState<State>("idle");
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [transcribeWarning, setTranscribeWarning] = useState("");
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
      setError("Microphone access denied.");
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
    } catch {
      setTranscribeWarning(
        "Could not transcribe audio — add written notes to continue."
      );
    }
    setState("idle");
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

  if (state === "done") {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
        <p className="text-green-600 text-2xl font-bold">Report submitted!</p>
        <button
          onClick={() => {
            setState("idle");
            setTranscript("");
            setNotes("");
            setError("");
          }}
          className="bg-blue-600 text-white py-4 px-10 rounded-2xl text-lg font-semibold"
        >
          Submit another
        </button>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6 p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-800">Caregiver Report</h1>

      <div className="flex flex-col gap-2">
        <label className="font-semibold text-gray-700">Voice Notes</label>
        {state === "recording" ? (
          <button
            onClick={stopRecording}
            className="bg-red-500 text-white py-4 rounded-2xl text-lg font-semibold"
          >
            ■ Stop Recording
          </button>
        ) : (
          <button
            onClick={startRecording}
            disabled={busy}
            className="bg-blue-600 text-white py-4 rounded-2xl text-lg font-semibold disabled:opacity-50"
          >
            {state === "transcribing" ? "Transcribing..." : "● Record"}
          </button>
        )}
        {transcribeWarning && (
          <p className="text-yellow-600 text-sm">{transcribeWarning}</p>
        )}
        {transcript && (
          <p className="bg-gray-100 rounded-xl p-3 text-gray-700 text-sm">
            {transcript}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="font-semibold text-gray-700">
          Written Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          disabled={busy}
          placeholder="Type notes here..."
          className="border border-gray-300 rounded-xl p-3 text-gray-800 resize-none disabled:opacity-50"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="bg-blue-600 text-white py-4 rounded-2xl text-lg font-semibold disabled:opacity-40"
      >
        {state === "submitting" ? "Submitting..." : "Submit Report"}
      </button>
    </main>
  );
}
