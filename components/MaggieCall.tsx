"use client";

// ---------------------------------------------------------------------------
// MaggieCall — floating live-call widget
// ---------------------------------------------------------------------------
// A collapsed action button in the corner that expands into a calling card.
// Every vendor-specific concern lives behind the VoiceClientFactory in
// lib/voiceClient.ts, and every state decision lives in lib/useMaggieCall.ts,
// so this file is only presentation.
//
// Palette is deliberately narrow and high-contrast: white surface, near-black
// structure, and red reserved *exclusively* for a live microphone. Red never
// appears as decoration — when a visitor sees red on this widget, they are on
// an open mic. That's what makes it readable at a glance.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Phone, PhoneOff, X, Mic, MicOff, Loader2, AlertCircle, Check } from "lucide-react";
import { useMaggieCall } from "@/lib/useMaggieCall";
import { resolveVoiceClientFactory } from "@/lib/voiceClient";
import type { CallLanguage, VoiceClientFactory } from "@/lib/voiceClient";
import { site } from "@/lib/site";

/**
 * The browser can only listen in one language at a time, so a caller who
 * doesn't speak English needs a way to say so without speaking English. Each
 * label is written in its own language, so the person who needs it can read it.
 */
const CALL_LANGUAGES: { code: CallLanguage; label: string; start: string }[] = [
  { code: "en", label: "English", start: "Start the call" },
  { code: "es", label: "Español", start: "Llamar en español" },
  { code: "ko", label: "한국어", start: "한국어로 통화하기" },
  { code: "vi", label: "Tiếng Việt", start: "Gọi bằng tiếng Việt" },
  { code: "zh", label: "中文", start: "用中文通话" },
];

export interface MaggieCallProps {
  /**
   * Where calls actually go. Defaults to the provider named by
   * NEXT_PUBLIC_VOICE_PROVIDER, which falls back to a local simulation.
   * Pass your own factory to use any WebRTC vendor.
   */
  createClient?: VoiceClientFactory;
  assistantName?: string;
  companyName?: string;
  /** Fallback for visitors who can't or won't use a microphone. */
  fallbackPhoneRaw?: string;
  fallbackPhoneDisplay?: string;
  /** Opposite corner from the chat widget by default. */
  position?: "bottom-right" | "bottom-left";
  /** Start expanded — useful on a dedicated "talk to Maggie" landing page. */
  defaultOpen?: boolean;
  onCallStart?: () => void;
  onCallEnd?: (durationSeconds: number) => void;
  onError?: (error: Error) => void;
  className?: string;
}

const CORNER = {
  "bottom-right": "bottom-4 right-4 sm:bottom-6 sm:right-6",
  "bottom-left": "bottom-4 left-4 sm:bottom-6 sm:left-6",
} as const;

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MaggieCall({
  createClient,
  assistantName = "Maggie Mae",
  companyName = site.name,
  fallbackPhoneRaw = site.phoneRaw,
  fallbackPhoneDisplay = site.phoneDisplay,
  position = "bottom-right",
  defaultOpen = false,
  onCallStart,
  onCallEnd,
  onError,
  className = "",
}: MaggieCallProps) {
  const [mounted, setMounted] = useState(defaultOpen);
  const [open, setOpen] = useState(defaultOpen);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  // Resolve once. Rebuilding the factory each render would hand the hook a new
  // identity every time and thrash its callbacks.
  const factory = useMemo(() => createClient ?? resolveVoiceClientFactory(), [createClient]);

  const call = useMaggieCall({ createClient: factory, onCallStart, onCallEnd, onError });
  const { state, error, level, muted, elapsed, transcript, isSimulated, language } = call;
  // Retry and "call again" keep the language the caller already picked.
  const restart = useCallback(() => call.start(language ?? undefined), [call, language]);

  const isLive = state === "active";
  const isBusy = state === "requesting-mic" || state === "connecting";

  // --- open / close --------------------------------------------------------

  const expand = useCallback(() => {
    setMounted(true);
    // Paint once collapsed, then transition — otherwise the browser batches
    // mount and final state together and the card simply appears.
    requestAnimationFrame(() => setOpen(true));
  }, []);

  const collapse = useCallback(() => {
    setOpen(false);
    if (isLive || isBusy) call.end();
    window.setTimeout(() => {
      setMounted(false);
      call.reset();
    }, 200);
  }, [call, isBusy, isLive]);

  // Escape closes, matching every other dismissible surface on the web.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") collapse();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, collapse]);

  // Move focus into the card so keyboard users land on the action, not at the
  // top of the document.
  useEffect(() => {
    if (open) primaryRef.current?.focus({ preventScroll: true });
  }, [open, state]);

  // --- render --------------------------------------------------------------

  return (
    <div className={`fixed z-50 ${CORNER[position]} ${className}`}>
      {mounted && (
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="false"
          aria-label={`Live call with ${assistantName}, AI receptionist`}
          className={[
            // The card is wider than a phone screen minus its margins, so it's
            // capped by viewport width. It also lifts above the chat widget in
            // the opposite corner on small screens.
            "absolute bottom-0 w-[min(22rem,calc(100vw-2rem))]",
            position === "bottom-right" ? "right-0 origin-bottom-right" : "left-0 origin-bottom-left",
            "overflow-hidden rounded-2xl bg-white text-neutral-900",
            "shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45)] ring-1",
            isLive ? "ring-2 ring-red-600" : "ring-neutral-900/10",
            "transition-all duration-200 ease-out",
            open ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-95 opacity-0",
          ].join(" ")}
        >
          <Header
            assistantName={assistantName}
            companyName={companyName}
            isLive={isLive}
            elapsed={elapsed}
            onClose={collapse}
          />

          <div className="px-5 py-5">
            {state === "ready" && (
              <ReadyBody assistantName={assistantName} onStart={call.start} primaryRef={primaryRef} />
            )}

            {state === "requesting-mic" && (
              <StatusBody
                icon={<Mic className="h-6 w-6" aria-hidden />}
                title="Allow your microphone"
                body={`Your browser is asking permission. Choose Allow and ${assistantName} will pick up.`}
              />
            )}

            {state === "connecting" && (
              <StatusBody
                icon={<Loader2 className="h-6 w-6 animate-spin" aria-hidden />}
                title={`Connecting you to ${assistantName}…`}
                body="One moment — putting you through now."
                accent
              />
            )}

            {isLive && (
              <LiveBody
                assistantName={assistantName}
                level={level}
                muted={muted}
                transcript={transcript}
                language={language ?? "en"}
                onLanguage={isSimulated ? undefined : call.setLanguage}
                onToggleMute={call.toggleMute}
                onEnd={call.end}
                primaryRef={primaryRef}
              />
            )}

            {state === "ended" && (
              <EndedBody
                assistantName={assistantName}
                elapsed={elapsed}
                onAgain={restart}
                phoneRaw={fallbackPhoneRaw}
                phoneDisplay={fallbackPhoneDisplay}
                primaryRef={primaryRef}
              />
            )}

            {state === "error" && error && (
              <ErrorBody
                error={error}
                onRetry={restart}
                phoneRaw={fallbackPhoneRaw}
                phoneDisplay={fallbackPhoneDisplay}
                primaryRef={primaryRef}
              />
            )}
          </div>

          {isSimulated && isLive && (
            <p className="border-t border-neutral-200 bg-neutral-50 px-5 py-2 text-[11px] font-medium text-neutral-500">
              Demo mode — simulated call. Connect a voice provider to go live.
            </p>
          )}
        </div>
      )}

      {/* Collapsed action button. Hidden from AT while the card is open so the
          widget presents as one control, not two. */}
      <button
        type="button"
        onClick={expand}
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
        className={[
          "group flex items-center gap-3 rounded-full bg-neutral-900 py-3 pl-3 pr-3 sm:pr-5",
          "text-white shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)]",
          "ring-1 ring-white/10 transition-all duration-200",
          "hover:bg-black hover:shadow-[0_14px_36px_-8px_rgba(0,0,0,0.7)]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2",
          "active:scale-95",
          open ? "pointer-events-none scale-90 opacity-0" : "scale-100 opacity-100",
        ].join(" ")}
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600">
          {/* z-10 keeps the icon above the ring: the absolutely-positioned
              ring paints on a later layer than in-flow content regardless of
              DOM order, and would otherwise wash over the glyph on each pulse. */}
          <Phone className="relative z-10 h-4 w-4" aria-hidden />
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-red-600" aria-hidden />
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-bold leading-tight">Talk to {assistantName}</span>
          <span className="block text-[11px] font-medium leading-tight text-white/60">
            AI receptionist · live now
          </span>
        </span>
        <span className="sr-only sm:hidden">Talk to {assistantName}, our AI receptionist</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Header({
  assistantName,
  companyName,
  isLive,
  elapsed,
  onClose,
}: {
  assistantName: string;
  companyName: string;
  isLive: boolean;
  elapsed: number;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-neutral-900 px-5 py-4 text-white">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold ring-1 ring-white/15">
        MM
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-neutral-900 ${
            isLive ? "bg-red-500" : "bg-emerald-400"
          }`}
          aria-hidden
        />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-tight">{assistantName}</p>
        <p className="truncate text-[11px] leading-tight text-white/60">
          {isLive ? `${companyName} · on the line` : `AI Receptionist · ${companyName}`}
        </p>
      </div>

      {isLive && (
        <span
          className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold tabular-nums"
          aria-live="off"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden />
          {mmss(elapsed)}
        </span>
      )}

      <button
        type="button"
        onClick={onClose}
        title={isLive ? "End call and close" : "Close"}
        aria-label={isLive ? "End call and close" : "Close"}
        className="-mr-1 rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function ReadyBody({
  assistantName,
  onStart,
  primaryRef,
}: {
  assistantName: string;
  onStart: (language?: CallLanguage) => void;
  primaryRef: React.RefObject<HTMLButtonElement>;
}) {
  const [english, ...others] = CALL_LANGUAGES;
  return (
    <div>
      <h2 className="text-lg font-extrabold leading-snug tracking-tight text-neutral-900">
        Have a real conversation with {assistantName}.
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">
        No scripts, no phone menus, no waiting on hold. Ask her about hail damage, a
        leak, or what a new roof might run — she answers like a person would, any
        hour of the day.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600" lang="es">
        Hable en español si prefiere — ella le contesta en español.
      </p>
      <p className="mt-1 text-sm leading-relaxed text-neutral-600" lang="ko">
        한국어로 말씀하셔도 돼요 — 한국어로 답해 드려요.
      </p>
      <p className="mt-1 text-sm leading-relaxed text-neutral-600" lang="vi">
        Anh chị có thể nói tiếng Việt — Maggie sẽ trả lời bằng tiếng Việt.
      </p>
      <p className="mt-1 text-sm leading-relaxed text-neutral-600" lang="zh-Hans">
        您也可以说中文——她会用中文回答您。
      </p>

      <ul className="mt-4 space-y-1.5">
        {[
          "Answers 24/7, first ring",
          "English, Spanish, Korean, Vietnamese or Chinese — she switches when you do",
          "Speaks freely — nothing is scripted",
          "Hang up whenever you like",
        ].map(
          (line) => (
            <li key={line} className="flex items-start gap-2 text-[13px] font-medium text-neutral-700">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden />
              {line}
            </li>
          ),
        )}
      </ul>

      <button
        ref={primaryRef}
        type="button"
        onClick={() => onStart(english.code)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 active:scale-[0.98]"
      >
        <Phone className="h-4 w-4" aria-hidden />
        {english.start}
      </button>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {others.map((l) => (
          <button
            key={l.code}
            type="button"
            lang={l.code}
            onClick={() => onStart(l.code)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-neutral-100 px-3 py-2.5 text-[13px] font-bold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden />
            {l.start}
          </button>
        ))}
      </div>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-neutral-500">
        We&rsquo;ll ask for your microphone next. Talking to {assistantName} is free.
      </p>
    </div>
  );
}

function StatusBody({
  icon,
  title,
  body,
  accent = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div className="py-4 text-center" aria-live="polite">
      <div
        className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
          accent ? "bg-red-50 text-red-600" : "bg-neutral-100 text-neutral-900"
        }`}
      >
        {icon}
      </div>
      <p className="mt-4 text-sm font-bold text-neutral-900">{title}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600">{body}</p>
    </div>
  );
}

function LiveBody({
  assistantName,
  level,
  muted,
  transcript,
  language,
  onLanguage,
  onToggleMute,
  onEnd,
  primaryRef,
}: {
  assistantName: string;
  level: number;
  muted: boolean;
  transcript: { role: string; text: string }[];
  language: CallLanguage;
  /** Absent when the client can't switch (the simulated demo call). */
  onLanguage?: (language: CallLanguage) => void;
  onToggleMute: () => void;
  onEnd: () => void;
  primaryRef: React.RefObject<HTMLButtonElement>;
}) {
  const latest = transcript[transcript.length - 1];

  return (
    <div>
      {onLanguage && (
        <div className="mb-3 flex flex-wrap justify-center gap-1" role="group" aria-label="Call language">
          {CALL_LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              lang={l.code}
              aria-pressed={language === l.code}
              onClick={() => onLanguage(l.code)}
              className={`rounded-full px-2.5 py-1 text-[12px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 ${
                language === l.code
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      <Wave level={muted ? 0 : level} muted={muted} />

      <p className="mt-3 text-center text-[13px] font-semibold text-neutral-900" aria-live="polite">
        {muted ? "Your microphone is off" : `${assistantName} is listening — go ahead`}
      </p>

      {/* Live captions. Fixed height so the card doesn't jump on every word. */}
      <div className="mt-3 flex h-16 items-center justify-center rounded-xl bg-neutral-50 px-3 ring-1 ring-neutral-900/5">
        {latest ? (
          <p className="line-clamp-3 text-center text-[12px] leading-relaxed text-neutral-600">
            <span className="font-bold text-neutral-900">
              {latest.role === "maggie" ? assistantName : "You"}:
            </span>{" "}
            {latest.text}
          </p>
        ) : (
          <p className="text-[12px] text-neutral-400">Say hello to get started…</p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onToggleMute}
          aria-pressed={muted}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 active:scale-[0.98] ${
            muted
              ? "bg-neutral-900 text-white hover:bg-black"
              : "bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
          }`}
        >
          {muted ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
          {muted ? "Unmute" : "Mute"}
        </button>

        <button
          ref={primaryRef}
          type="button"
          onClick={onEnd}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 active:scale-[0.98]"
        >
          <PhoneOff className="h-4 w-4" aria-hidden />
          End call
        </button>
      </div>
    </div>
  );
}

/**
 * Speaking-level wave. Bars are driven by real audio, not a canned animation —
 * a fake waveform that moves while nobody is talking teaches the visitor the
 * indicator means nothing.
 */
function Wave({ level, muted }: { level: number; muted: boolean }) {
  // Fixed weights give the bars a natural centre-weighted shape.
  const weights = [0.45, 0.7, 0.95, 1, 0.95, 0.7, 0.45];

  return (
    <div
      className="flex h-14 items-center justify-center gap-1.5"
      role="img"
      aria-label={muted ? "Microphone muted" : "Live call in progress"}
    >
      {weights.map((w, i) => {
        const height = muted ? 6 : Math.max(6, Math.min(48, 6 + level * w * 60));
        return (
          <span
            key={i}
            className={`w-1.5 rounded-full transition-[height] duration-100 ease-out ${
              muted ? "bg-neutral-300" : "bg-red-600"
            }`}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
}

function EndedBody({
  assistantName,
  elapsed,
  onAgain,
  phoneRaw,
  phoneDisplay,
  primaryRef,
}: {
  assistantName: string;
  elapsed: number;
  onAgain: () => void;
  phoneRaw: string;
  phoneDisplay: string;
  primaryRef: React.RefObject<HTMLButtonElement>;
}) {
  return (
    <div className="text-center" aria-live="polite">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-900">
        <Check className="h-6 w-6" aria-hidden />
      </div>
      <p className="mt-4 text-sm font-bold text-neutral-900">
        Call ended{elapsed > 0 ? ` · ${mmss(elapsed)}` : ""}
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600">
        Thanks for trying {assistantName}. If you left your details, our team will follow up shortly.
      </p>

      <button
        ref={primaryRef}
        type="button"
        onClick={onAgain}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 active:scale-[0.98]"
      >
        <Phone className="h-4 w-4" aria-hidden />
        Call again
      </button>

      <a
        href={`tel:${phoneRaw}`}
        className="mt-2 block rounded-xl px-5 py-2.5 text-[13px] font-semibold text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
      >
        Or reach a person at {phoneDisplay}
      </a>
    </div>
  );
}

function ErrorBody({
  error,
  onRetry,
  phoneRaw,
  phoneDisplay,
  primaryRef,
}: {
  error: { message: string; isPermission: boolean };
  onRetry: () => void;
  phoneRaw: string;
  phoneDisplay: string;
  primaryRef: React.RefObject<HTMLButtonElement>;
}) {
  return (
    <div className="text-center" role="alert">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertCircle className="h-6 w-6" aria-hidden />
      </div>
      <p className="mt-4 text-sm font-bold text-neutral-900">
        {error.isPermission ? "We need your microphone" : "That call didn't connect"}
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600">{error.message}</p>
      {error.isPermission && (
        <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
          Click the padlock in your browser&rsquo;s address bar, allow the microphone, then try again.
        </p>
      )}

      <button
        ref={primaryRef}
        type="button"
        onClick={onRetry}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 active:scale-[0.98]"
      >
        Try again
      </button>

      <a
        href={`tel:${phoneRaw}`}
        className="mt-2 block rounded-xl bg-red-600 px-5 py-3 text-[13px] font-bold text-white transition hover:bg-red-700"
      >
        Call us instead · {phoneDisplay}
      </a>
    </div>
  );
}
