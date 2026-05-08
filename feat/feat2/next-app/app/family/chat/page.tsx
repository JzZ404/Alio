"use client";

import { useState } from "react";

interface ChatMessage {
  id: number;
  from: "family" | "caregiver";
  type: "text" | "voice";
  text?: string;
  duration?: string;
  tasks?: { done: boolean; label: string }[];
  time: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    from: "caregiver",
    type: "voice",
    duration: "3:02",
    tasks: [
      { done: true, label: "Clean the bathroom" },
      { done: false, label: "Help Harold shower" },
      { done: false, label: "Daily medication" },
      { done: false, label: "Evening walk" },
    ],
    time: "9:14 AM",
  },
  {
    id: 2,
    from: "family",
    type: "text",
    text: "Thanks Sarah! How was his mood this morning?",
    time: "9:22 AM",
  },
  {
    id: 3,
    from: "caregiver",
    type: "voice",
    duration: "2:39",
    tasks: [
      { done: true, label: "Clean the bathroom" },
      { done: true, label: "Help Harold shower" },
      { done: false, label: "Daily medication" },
      { done: false, label: "Evening walk" },
    ],
    time: "9:31 AM",
  },
];

const QUICK_REPLIES = [
  "Running 10 min late",
  "All good today 👍",
  "Please call me",
  "Medication done ✓",
];

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

export default function FamilyChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [nextId, setNextId] = useState(100);

  function sendText(text: string) {
    if (!text.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: nextId,
        from: "family",
        type: "text",
        text: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setNextId((n) => n + 1);
    setInput("");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 border-b border-[#F0F0F8]">
        <div className="w-10 h-10 rounded-full bg-[#5654FF]/15 flex items-center justify-center flex-shrink-0">
          <span className="text-[#5654FF] text-xs font-bold">SM</span>
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-[#1A1A2E] text-[16px]">Sarah Mitchell</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
            <span className="text-[11px] text-[#9898B4]">Active now</span>
          </div>
        </div>
        <button className="w-9 h-9 rounded-full bg-[#F0F0FA] flex items-center justify-center">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#9898B4" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.32 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012.23 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 flex flex-col gap-4">
        {messages.map((msg) => {
          const isFamily = msg.from === "family";
          return (
            <div key={msg.id} className={`flex flex-col gap-2 ${isFamily ? "items-end" : "items-start"}`}>
              {msg.type === "voice" ? (
                <div className="max-w-[80%]">
                  {/* Voice bubble */}
                  <div
                    className="rounded-2xl px-4 py-3 flex items-center gap-3"
                    style={{
                      background: isFamily ? "#5654FF" : "#5654FF",
                      borderBottomRightRadius: isFamily ? 4 : undefined,
                      borderBottomLeftRadius: !isFamily ? 4 : undefined,
                    }}
                  >
                    <button className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <PlayIcon />
                    </button>
                    {/* waveform bars */}
                    <div className="flex items-center gap-[2px] flex-1">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-white/60"
                          style={{
                            width: 2,
                            height: 4 + Math.sin(i * 1.2) * 10 + 4,
                            opacity: 0.7 + Math.sin(i * 0.8) * 0.3,
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-white text-xs font-medium flex-shrink-0">
                      {msg.duration}
                    </span>
                  </div>

                  {/* Task checklist */}
                  {msg.tasks && (
                    <div className="bg-white rounded-2xl rounded-tl-sm mt-1 px-4 py-3 flex flex-col gap-1.5">
                      {msg.tasks.map((t, ti) => (
                        <div key={ti} className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded flex-shrink-0 border border-[#C4C4D4] flex items-center justify-center"
                            style={{
                              background: t.done ? "#5654FF" : "transparent",
                              borderColor: t.done ? "#5654FF" : "#C4C4D4",
                            }}
                          >
                            {t.done && (
                              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          <span
                            className="text-sm"
                            style={{
                              color: t.done ? "#9898B4" : "#1A1A2E",
                              textDecoration: t.done ? "line-through" : "none",
                            }}
                          >
                            {t.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="max-w-[78%] rounded-2xl px-4 py-3 text-[14px] leading-snug"
                  style={{
                    background: isFamily ? "#5654FF" : "#fff",
                    color: isFamily ? "#fff" : "#1A1A2E",
                    borderBottomRightRadius: isFamily ? 4 : undefined,
                    borderBottomLeftRadius: !isFamily ? 4 : undefined,
                  }}
                >
                  {msg.text}
                </div>
              )}
              <span className="text-[10px] text-[#C4C4D4]">{msg.time}</span>
            </div>
          );
        })}
      </div>

      {/* Quick replies */}
      <div className="px-4 overflow-x-auto no-scrollbar flex gap-2 pb-2">
        {QUICK_REPLIES.map((q) => (
          <button
            key={q}
            onClick={() => sendText(q)}
            className="flex-shrink-0 bg-white text-[#5654FF] text-[12px] font-medium rounded-full px-3 py-1.5 border border-[#EEEEF5]"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div className="px-4 pb-4 pt-1">
        <div className="bg-white rounded-2xl px-4 py-2.5 flex items-center gap-3" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendText(input)}
            placeholder="Message Sarah…"
            className="flex-1 text-[14px] text-[#1A1A2E] outline-none bg-transparent placeholder:text-[#C4C4D4]"
          />
          <button
            onClick={() => sendText(input)}
            disabled={!input.trim()}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-30 transition-opacity"
            style={{ background: "#5654FF" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
