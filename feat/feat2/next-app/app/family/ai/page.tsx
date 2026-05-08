"use client";

import { useState } from "react";
import { api } from "@/lib/api";

type State = "idle" | "listening" | "thinking" | "done";

interface Message {
  role: "user" | "ai";
  text: string;
}

function WaveformIcon() {
  return (
    <div className="flex items-center gap-[3px] h-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="wave-bar w-[3px] rounded-full"
          style={{ background: "#1A1A2E", minHeight: 4 }}
        />
      ))}
    </div>
  );
}

const EXAMPLE_QA: Message[] = [
  {
    role: "user",
    text: "How was Harold's blood pressure this week?",
  },
  {
    role: "ai",
    text: "Based on the last 3 visit reports, Harold's blood pressure has been stable at 118/76 mmHg — within the healthy range. Sarah noted no symptoms of dizziness or headaches.\n\n⚕️ This is not medical advice. Please consult Harold's doctor for clinical decisions.",
  },
];

export default function FamilyAI() {
  const [state, setState] = useState<State>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);

  async function handleSpeak() {
    if (state !== "idle") return;
    setState("listening");
    setTimeout(() => {
      setState("thinking");
      const q = EXAMPLE_QA[0].text;
      setQuestion(q);
      setTimeout(async () => {
        try {
          const { dates } = await api.listReports();
          let answer = EXAMPLE_QA[1].text;
          if (dates.length > 0) {
            const report = await api.getReport(dates[0]);
            answer = `Based on the visit report from ${dates[0]}: ${report.summary}\n\nMood: ${report.mood || "N/A"} | Medications noted: ${report.medications_noted?.join(", ") || "none"}.\n\n⚕️ This is not medical advice. Please consult Harold's doctor for clinical decisions.`;
          }
          setMessages((prev) => [
            ...prev,
            { role: "user", text: q },
            { role: "ai", text: answer },
          ]);
        } catch {
          setMessages((prev) => [
            ...prev,
            { role: "user", text: q },
            ...EXAMPLE_QA.slice(1),
          ]);
        }
        setState("idle");
        setQuestion("");
      }, 2000);
    }, 2500);
  }

  async function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || state !== "idle") return;
    const q = question.trim();
    setQuestion("");
    setState("thinking");
    try {
      const { dates } = await api.listReports();
      let answer = "I don't have enough data yet — ask the caregiver to submit a visit report first.";
      if (dates.length > 0) {
        const report = await api.getReport(dates[0]);
        answer = `Based on ${dates[0]}'s visit: ${report.summary}\n\nMood: ${report.mood || "N/A"} | Medications: ${report.medications_noted?.join(", ") || "none"}.\n\n⚕️ This is not medical advice. Consult Harold's doctor for clinical decisions.`;
      }
      setMessages((prev) => [
        ...prev,
        { role: "user", text: q },
        { role: "ai", text: answer },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "user", text: q },
        { role: "ai", text: "Something went wrong. Please try again." },
      ]);
    }
    setState("idle");
  }

  const isListening = state === "listening";
  const isThinking = state === "thinking";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <div className="text-center flex-1">
          <p className="text-[11px] text-[#9898B4] font-medium tracking-wide">
            AI Health Check
          </p>
          <h2 className="text-[17px] font-bold text-[#1A1A2E]">
            Harold&#39;s Care
          </h2>
        </div>
        <button className="w-9 h-9 rounded-full bg-[#F0F0FA] flex items-center justify-center">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#9898B4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>

      {/* Blob / chat area */}
      <div className="flex-1 flex flex-col items-center justify-start px-5 overflow-y-auto no-scrollbar">
        {messages.length === 0 && !isThinking ? (
          /* listening state */
          <div className="flex flex-col items-center justify-center flex-1 w-full">
            <p className="text-[#1A1A2E] text-xl font-semibold mb-8">
              {isListening ? "Listening…" : "Hi, I am listening"}
            </p>

            {/* Blob */}
            <div className="relative w-52 h-52 flex items-center justify-center mb-8">
              <div
                className="blob-3 absolute rounded-full"
                style={{
                  width: 200,
                  height: 200,
                  background:
                    "radial-gradient(circle at 40% 35%, #C8B8FF 0%, #E8D0FF 50%, #F0EAFF 100%)",
                  opacity: 0.5,
                }}
              />
              <div
                className="blob-2 absolute rounded-full"
                style={{
                  width: 160,
                  height: 160,
                  background:
                    "radial-gradient(circle at 55% 45%, #B8B0FF 0%, #D8C0FF 60%, transparent 100%)",
                  opacity: 0.65,
                }}
              />
              <div
                className="blob-1 absolute rounded-full"
                style={{
                  width: 120,
                  height: 120,
                  background:
                    "radial-gradient(circle at 45% 40%, #9898FF 0%, #C8B8FF 55%, #EECFFF 100%)",
                  opacity: 0.8,
                }}
              />
              {isListening && (
                <div className="relative z-10 flex items-center gap-[4px]">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="wave-bar w-[4px] rounded-full bg-[#5654FF]"
                      style={{ minHeight: 4 }}
                    />
                  ))}
                </div>
              )}
            </div>

            {question && (
              <p className="text-[#1A1A2E] text-center text-sm px-6 italic">
                &ldquo;{question}&rdquo;
              </p>
            )}
          </div>
        ) : (
          /* messages */
          <div className="w-full flex flex-col gap-3 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line"
                  style={{
                    background: m.role === "user" ? "#5654FF" : "#fff",
                    color: m.role === "user" ? "#fff" : "#1A1A2E",
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <span className="w-2 h-2 rounded-full bg-[#C4C4D4] animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-[#C4C4D4] animate-bounce [animation-delay:0.15s]" />
                    <span className="w-2 h-2 rounded-full bg-[#C4C4D4] animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="px-4 pb-4 pt-2">
        {showKeyboard ? (
          <form onSubmit={handleTextSubmit} className="flex gap-2">
            <input
              autoFocus
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about Harold's health…"
              className="flex-1 bg-white rounded-xl px-4 py-3 text-sm text-[#1A1A2E] outline-none border border-[#EEEEF5]"
            />
            <button
              type="submit"
              disabled={!question.trim() || state !== "idle"}
              className="bg-[#5654FF] text-white rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
            >
              Send
            </button>
          </form>
        ) : (
          <div
            className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
          >
            <button
              onClick={() => setShowKeyboard(true)}
              className="w-9 h-9 rounded-xl bg-[#F0F0FA] flex items-center justify-center flex-shrink-0"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#9898B4" strokeWidth="1.8">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12" strokeLinecap="round" />
              </svg>
            </button>

            <button
              onClick={handleSpeak}
              disabled={state !== "idle"}
              className="flex-1 rounded-xl py-2.5 flex items-center justify-center gap-2 font-semibold text-[#1A1A2E] text-[15px] disabled:opacity-60 transition-opacity"
              style={{ background: "#D5FF2C" }}
            >
              {isListening ? (
                <WaveformIcon />
              ) : (
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#1A1A2E" strokeWidth="2">
                  <rect x="9" y="2" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0014 0" strokeLinecap="round" />
                  <line x1="12" y1="18" x2="12" y2="22" strokeLinecap="round" />
                </svg>
              )}
              {isListening ? "Listening…" : isThinking ? "Thinking…" : "Press to Speak"}
            </button>

            <button
              onClick={() => {
                setMessages([]);
                setState("idle");
              }}
              className="w-9 h-9 rounded-xl bg-[#F0F0FA] flex items-center justify-center flex-shrink-0 text-[#9898B4] text-xl font-light"
            >
              ↺
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
