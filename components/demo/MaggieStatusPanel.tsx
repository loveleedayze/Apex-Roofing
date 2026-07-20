"use client";

// ---------------------------------------------------------------------------
// "Maggie Mae AI Assistant Status" — the hero of the demo dashboard.
// Three states (online / on a live call / wrapping up), a live transcript that
// streams line-by-line, and the summary + action items left behind afterwards.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import { PhoneCall, Sparkles, ClipboardCheck } from "lucide-react";
import { useDemo, type MaggieStatus } from "./DemoProvider";

const STATUS_COPY: Record<
  MaggieStatus,
  { label: string; dot: string; ring: boolean; tone: string }
> = {
  online: {
    label: "🟢 Online & Monitoring Lines",
    dot: "bg-emerald-500",
    ring: false,
    tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  on_call: {
    label: "🔴 On a live call with a homeowner… (Simulated)",
    dot: "bg-red-500",
    ring: true,
    tone: "text-red-700 bg-red-50 border-red-200",
  },
  wrapping: {
    label: "🟡 Wrapping up — writing call notes… (Simulated)",
    dot: "bg-amber-500",
    ring: true,
    tone: "text-amber-700 bg-amber-50 border-amber-200",
  },
};

export default function MaggieStatusPanel() {
  const { status, transcript, summary, callsHandled, simulateCall, isCallActive } =
    useDemo();
  const copy = STATUS_COPY[status];

  // Keep the newest transcript line in view as the call streams in.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript.length]);

  return (
    <section
      aria-labelledby="maggie-status-heading"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-brand-navy px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-accent">
            <Sparkles className="h-5 w-5 text-white" aria-hidden />
          </div>
          <div>
            <h2
              id="maggie-status-heading"
              className="text-lg font-extrabold tracking-tight text-white"
            >
              Maggie Mae AI Assistant Status
            </h2>
            <p className="text-xs text-white/55">
              {callsHandled === 0
                ? "No calls handled in this session yet"
                : `${callsHandled} call${callsHandled === 1 ? "" : "s"} handled in this session`}
            </p>
          </div>
        </div>

        {/* Live status pill */}
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${copy.tone}`}
        >
          <span className="relative flex h-2.5 w-2.5">
            {copy.ring && (
              <span
                className={`absolute inline-flex h-full w-full rounded-full ${copy.dot} animate-pulse-ring`}
                aria-hidden
              />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${copy.dot}`}
              aria-hidden
            />
          </span>
          {copy.label}
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-2">
        {/* ---- Live transcript ---- */}
        <div className="flex flex-col">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            Live Call Transcript
          </h3>
          <div
            ref={scrollRef}
            className="h-64 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200"
          >
            {transcript.length === 0 && !isCallActive && (
              <p className="grid h-full place-items-center px-6 text-center text-sm text-slate-400">
                Maggie is standing by. Start the simulation to watch her take a
                call and book the job.
              </p>
            )}

            {transcript.map((line, i) => (
              <div
                key={i}
                className={`flex ${
                  line.speaker === "maggie" ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={[
                    "max-w-[85%] animate-fade-up rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
                    line.speaker === "maggie"
                      ? "rounded-bl-sm bg-white text-brand-navy ring-1 ring-slate-200"
                      : "rounded-br-sm bg-brand-steel text-white",
                  ].join(" ")}
                >
                  <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider opacity-60">
                    {line.speaker === "maggie" ? "Maggie Mae" : "Homeowner"}
                  </span>
                  {line.text}
                </div>
              </div>
            ))}

            {/* Typing indicator while the next line is pending. */}
            {status === "on_call" && (
              <div className="flex justify-start" aria-hidden>
                <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-white px-3 py-2.5 ring-1 ring-slate-200">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ---- Summary / action items ---- */}
        <div className="flex flex-col">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            Last Call Summary / Action Items
          </h3>
          <div className="flex-1 rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
            {summary ? (
              <div className="animate-fade-up">
                <p className="text-sm font-semibold leading-relaxed text-brand-navy">
                  {summary.headline}
                </p>
                <ul className="mt-3 space-y-2">
                  {summary.actionItems.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-slate-600">
                      <ClipboardCheck
                        className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent"
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                {isCallActive
                  ? "Maggie will drop her notes here the moment the call ends…"
                  : "No calls yet this session. Summary and action items will appear here."}
              </p>
            )}
          </div>

          {/* ---- The button ---- */}
          <button
            type="button"
            onClick={simulateCall}
            disabled={isCallActive}
            className="btn-cta mt-4 w-full py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PhoneCall className="h-5 w-5" aria-hidden />
            {isCallActive
              ? "Call in progress…"
              : "👉 Simulate a Live Homeowner Call"}
          </button>
        </div>
      </div>
    </section>
  );
}
