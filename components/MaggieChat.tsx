"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Sparkles, Bot } from "lucide-react";

type Msg = { from: "maggie" | "user"; text: string; time: string };

const now = () =>
  new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

// Pre-seeded transcript demonstrating storm-vs-routine qualification.
const SEED: Msg[] = [
  {
    from: "maggie",
    text: "Hi, I'm Maggie Mae, your AI Receptionist at Apex Roofing! 👋 Are you dealing with storm/leak damage, or looking for a routine roofing estimate?",
    time: "9:14 AM",
  },
  {
    from: "user",
    text: "We had hail last night and I see shingles in the yard.",
    time: "9:14 AM",
  },
  {
    from: "maggie",
    text: "That sounds like storm damage — I'm marking this URGENT. 🚨 We prioritize hail/wind claims same-day. What's your name and best callback number so I can dispatch an inspector?",
    time: "9:15 AM",
  },
];

export default function MaggieChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(SEED);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [contact, setContact] = useState({ name: "", phone: "" });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing, open]);

  async function send() {
    const text = input.trim();
    if (!text) return;
    const userMsg: Msg = { from: "user", text, time: now() };
    const nextMsgs = [...msgs, userMsg];
    setMsgs(nextMsgs);
    setInput("");
    setTyping(true);

    // Try to opportunistically capture a phone number from the message.
    const phoneMatch = text.match(/(\+?\d[\d\s().-]{8,}\d)/);
    const captured = { ...contact };
    if (phoneMatch) captured.phone = phoneMatch[1];
    if (!captured.name && /(my name is|i'm|i am|this is)\s+([a-z]+)/i.test(text)) {
      captured.name = RegExp.$2;
    }
    setContact(captured);

    try {
      const finalize = Boolean(captured.phone); // enough to route to CRM
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          transcript: nextMsgs.map((m) => ({ role: m.from, text: m.text })),
          contact: captured,
          finalize,
        }),
      });
      const data = await res.json();
      setTimeout(() => {
        setTyping(false);
        setMsgs((m) => [...m, { from: "maggie", text: data.reply, time: now() }]);
      }, 700);
    } catch {
      setTyping(false);
      setMsgs((m) => [
        ...m,
        {
          from: "maggie",
          text: "Sorry, I hit a snag — please call us at (555) 123-ROOF and we'll help right away!",
          time: now(),
        },
      ]);
    }
  }

  return (
    // Anchored bottom-LEFT, distinct from typical right-side widgets.
    <div className="fixed bottom-4 left-4 z-50">
      {open ? (
        <div className="animate-fade-up flex h-[30rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-brand-navy to-brand-steel p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-accent">
                  <Bot size={22} />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-brand-navy bg-green-400" />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1 font-bold">
                  Maggie Mae <Sparkles size={13} className="text-brand-gold" />
                </div>
                <div className="text-[11px] text-white/70">AI Receptionist • Online</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat">
              <X size={20} />
            </button>
          </div>

          {/* Intro banner */}
          <div className="bg-orange-50 px-4 py-2 text-center text-xs font-semibold text-brand-accentDark">
            Hi, I&apos;m Maggie Mae, your AI Receptionist.
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {msgs.map((m, i) => (
              <Bubble key={i} m={m} />
            ))}
            {typing && (
              <div className="flex items-center gap-1 pl-1 text-slate-400">
                <Dot /> <Dot /> <Dot />
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="flex items-center gap-2 border-t border-slate-100 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type your message…"
              className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm outline-none focus:border-brand-accent"
            />
            <button
              onClick={send}
              className="grid h-10 w-10 place-items-center rounded-full bg-brand-accent text-white hover:bg-brand-accentDark"
              aria-label="Send message"
            >
              <Send size={17} />
            </button>
          </div>
        </div>
      ) : (
        /* Launcher bubble */
        <button
          onClick={() => setOpen(true)}
          className="group relative flex items-center gap-3 rounded-full bg-brand-navy py-2.5 pl-2.5 pr-5 text-white shadow-2xl transition hover:bg-brand-steel"
        >
          <span className="absolute inset-0 -z-10 rounded-full bg-brand-accent animate-pulse-ring" />
          <span className="relative grid h-10 w-10 place-items-center rounded-full bg-brand-accent">
            <MessageCircle size={22} />
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-brand-navy bg-green-400" />
          </span>
          <span className="text-left leading-tight">
            <span className="block text-sm font-bold">Chat with Maggie Mae</span>
            <span className="block text-[11px] text-white/70">AI Receptionist • Online</span>
          </span>
        </button>
      )}
    </div>
  );
}

function Bubble({ m }: { m: Msg }) {
  const mine = m.from === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
          mine
            ? "rounded-br-sm bg-brand-accent text-white"
            : "rounded-bl-sm bg-white text-brand-navy ring-1 ring-slate-100"
        }`}
      >
        {m.text}
        <div className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-slate-400"}`}>
          {m.time}
        </div>
      </div>
    </div>
  );
}

function Dot() {
  return <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />;
}
