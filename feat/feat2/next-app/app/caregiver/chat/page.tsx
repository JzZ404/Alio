"use client";

import { useState } from "react";

interface ChatMessage {
  id: number;
  from: "caregiver" | "family";
  text: string;
  time: string;
}

const INITIAL: ChatMessage[] = [
  { id: 1, from: "family", text: "Hi Sarah, how was Harold this morning?", time: "8:45 AM" },
  { id: 2, from: "caregiver", text: "He was in great spirits! We had breakfast together and he did his morning exercises. Blood pressure looked good.", time: "9:02 AM" },
  { id: 3, from: "family", text: "That's wonderful to hear, thank you 🙏", time: "9:15 AM" },
];

const QUICK_REPLIES = [
  "Running 10 min late",
  "All good today 👍",
  "Please call me",
  "Just arrived",
];

export default function CaregiverChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL);
  const [input, setInput] = useState("");
  const [nextId, setNextId] = useState(100);

  function send(text: string) {
    if (!text.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: nextId,
        from: "caregiver",
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
        <div className="w-10 h-10 rounded-full bg-[#22C55E]/20 flex items-center justify-center flex-shrink-0">
          <span className="text-[#22C55E] text-xs font-bold">J</span>
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-[#1A1A2E] text-[16px]">Janet (Family)</h2>
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
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 flex flex-col gap-3">
        {messages.map((msg) => {
          const isMe = msg.from === "caregiver";
          return (
            <div key={msg.id} className={`flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
              <div
                className="max-w-[78%] rounded-2xl px-4 py-3 text-[14px] leading-snug"
                style={{
                  background: isMe ? "#5654FF" : "#fff",
                  color: isMe ? "#fff" : "#1A1A2E",
                  borderBottomRightRadius: isMe ? 4 : undefined,
                  borderBottomLeftRadius: !isMe ? 4 : undefined,
                }}
              >
                {msg.text}
              </div>
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
            onClick={() => send(q)}
            className="flex-shrink-0 bg-white text-[#5654FF] text-[12px] font-medium rounded-full px-3 py-1.5 border border-[#EEEEF5]"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-1">
        <div className="bg-white rounded-2xl px-4 py-2.5 flex items-center gap-3" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Message Janet…"
            className="flex-1 text-[14px] text-[#1A1A2E] outline-none bg-transparent placeholder:text-[#C4C4D4]"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim()}
            className="w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-30"
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
