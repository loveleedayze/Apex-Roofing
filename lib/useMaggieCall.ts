"use client";

// ---------------------------------------------------------------------------
// useMaggieCall — the call state machine, separated from the pixels
// ---------------------------------------------------------------------------
// The widget renders; this hook decides. Keeping them apart means the same
// call logic can drive a different UI (a full-page "talk to Maggie" landing
// experience, an in-dashboard test button) without copy-pasting a state
// machine, and it makes the states testable without a DOM.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import type { CallLanguage, TranscriptLine, VoiceClient, VoiceClientFactory } from "@/lib/voiceClient";
import { asCallLanguage } from "@/lib/voiceClient";

export type CallState =
  | "ready" // expanded, nothing started yet
  | "requesting-mic" // browser permission prompt is up
  | "connecting" // permission granted, session being established
  | "active" // live audio both ways
  | "ended" // finished cleanly
  | "error"; // something failed; `error` explains what

export interface CallError {
  message: string;
  /** True when the fix is "allow the microphone", which needs different copy. */
  isPermission: boolean;
}

export interface UseMaggieCallOptions {
  createClient: VoiceClientFactory;
  onCallStart?: () => void;
  onCallEnd?: (durationSeconds: number) => void;
  onError?: (error: Error) => void;
}

export interface MaggieCallApi {
  state: CallState;
  error: CallError | null;
  /** 0..1 speaking level driving the wave. */
  level: number;
  muted: boolean;
  /** Seconds since the call connected. */
  elapsed: number;
  transcript: TranscriptLine[];
  isSimulated: boolean;
  /** The language the caller last picked, if they picked one. */
  language: CallLanguage | null;
  /** Start a call, optionally in a language the caller picked up front. */
  start: (language?: CallLanguage) => Promise<void>;
  /** Switch a live call's language. */
  setLanguage: (language: CallLanguage) => void;
  end: () => Promise<void>;
  toggleMute: () => void;
  reset: () => void;
}

export function useMaggieCall({
  createClient,
  onCallStart,
  onCallEnd,
  onError,
}: UseMaggieCallOptions): MaggieCallApi {
  const [state, setState] = useState<CallState>("ready");
  const [error, setError] = useState<CallError | null>(null);
  const [level, setLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [isSimulated, setIsSimulated] = useState(false);
  const [language, setLanguageState] = useState<CallLanguage | null>(null);

  const clientRef = useRef<VoiceClient | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  /** Set once a vendor reports its own volume, so we stop metering locally. */
  const vendorMetersRef = useRef(false);
  /** Guards against setState after unmount during async teardown. */
  const aliveRef = useRef(true);

  // --- teardown ------------------------------------------------------------

  const stopMetering = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      // A live microphone must not outlive the component. Leaving the track
      // open leaves the browser's recording indicator on, which reads to a
      // visitor as a site that's still listening after they hung up.
      aliveRef.current = false;
      clientRef.current?.stop().catch(() => {});
      clientRef.current = null;
      stopMetering();
      stopTimer();
    };
  }, [stopMetering, stopTimer]);

  // --- local microphone metering ------------------------------------------
  // Vendors differ on whether they report speaking volume. Rather than let the
  // wave sit dead on the ones that don't, we meter the caller's own mic. The
  // vendor's own levels win the moment they arrive.

  const startMetering = useCallback((stream: MediaStream) => {
    const Ctx: typeof AudioContext | undefined =
      typeof window !== "undefined"
        ? window.AudioContext || (window as any).webkitAudioContext
        : undefined;
    if (!Ctx) return;

    try {
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);

      const buf = new Uint8Array(analyser.frequencyBinCount);
      let lastEmit = 0;
      const tick = () => {
        if (!aliveRef.current) return;
        // ~20fps is plenty for a 7-bar wave and costs a third of the renders
        // that sampling every animation frame would.
        const now = performance.now();
        if (now - lastEmit < 50) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        lastEmit = now;

        analyser.getByteTimeDomainData(buf);
        if (!vendorMetersRef.current) {
          // RMS around the 128 midpoint, scaled into something that looks like
          // speech rather than a flatline.
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          setLevel(Math.min(1, rms * 3.5));
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // Metering is decorative. Never let it break a working call.
    }
  }, []);

  // --- lifecycle -----------------------------------------------------------

  const finish = useCallback(() => {
    if (!aliveRef.current) return;
    stopMetering();
    stopTimer();
    setLevel(0);
    setState((prev) => (prev === "error" ? prev : "ended"));
    const duration = startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : 0;
    onCallEnd?.(duration);
  }, [onCallEnd, stopMetering, stopTimer]);

  const fail = useCallback(
    (err: unknown, isPermission = false) => {
      const e = err instanceof Error ? err : new Error(String(err));
      if (aliveRef.current) {
        setError({ message: e.message, isPermission });
        setState("error");
        setLevel(0);
      }
      stopMetering();
      stopTimer();
      onError?.(e);
    },
    [onError, stopMetering, stopTimer],
  );

  const start = useCallback(async (requested?: CallLanguage) => {
    // Guarded because start is also wired straight to onClick, which hands
    // it a click event rather than a language.
    const picked = asCallLanguage(requested) ?? undefined;
    setLanguageState(picked ?? null);
    setError(null);
    setTranscript([]);
    setElapsed(0);
    setMuted(false);
    vendorMetersRef.current = false;

    // 1. Microphone permission, as its own visible step. The vendor SDKs would
    //    request this themselves, but then the browser prompt appears with no
    //    explanation and a denial surfaces as an opaque SDK error. Owning it
    //    lets us say what we're asking for and why.
    setState("requesting-mic");
    let stream: MediaStream;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser can't make voice calls. Try Chrome, Edge, or Safari.");
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      const name = (err as { name?: string })?.name;
      const denied = name === "NotAllowedError" || name === "SecurityError";
      const missing = name === "NotFoundError" || name === "DevicesNotFoundError";
      return fail(
        denied
          ? new Error("Microphone access was blocked, so Maggie can't hear you.")
          : missing
            ? new Error("No microphone found. Plug one in, or give us a call instead.")
            : err,
        denied,
      );
    }

    if (!aliveRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;
    startMetering(stream);

    // 2. Establish the session.
    setState("connecting");
    try {
      const client = await createClient({
        onConnected: () => {
          if (!aliveRef.current) return;
          setState("active");
          startedAtRef.current = Date.now();
          setElapsed(0);
          stopTimer();
          timerRef.current = setInterval(() => {
            setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000));
          }, 1000);
          onCallStart?.();
        },
        onDisconnected: finish,
        onError: (err) => fail(err),
        onVolume: (v) => {
          vendorMetersRef.current = true;
          if (aliveRef.current) setLevel(Math.max(0, Math.min(1, v)));
        },
        onTranscript: (line) => {
          if (!aliveRef.current) return;
          setTranscript((prev) => {
            // Interim results replace the previous interim from the same
            // speaker instead of stacking up a wall of half-sentences.
            const last = prev[prev.length - 1];
            if (last && !last.final && last.role === line.role) {
              return [...prev.slice(0, -1), line];
            }
            return [...prev, line];
          });
        },
      }, { language: picked });

      clientRef.current = client;
      setIsSimulated(client.isSimulated);
      await client.start();
    } catch (err) {
      fail(err);
    }
  }, [createClient, fail, finish, onCallStart, startMetering, stopTimer]);

  const end = useCallback(async () => {
    try {
      await clientRef.current?.stop();
    } catch {
      // Hanging up must always work, even if the vendor errors on the way out.
    }
    clientRef.current = null;
    finish();
  }, [finish]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      clientRef.current?.setMuted(next);
      streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
      if (next) setLevel(0);
      return next;
    });
  }, []);

  const setLanguage = useCallback((next: CallLanguage) => {
    setLanguageState(next);
    clientRef.current?.setLanguage?.(next);
  }, []);

  const reset = useCallback(() => {
    clientRef.current?.stop().catch(() => {});
    clientRef.current = null;
    stopMetering();
    stopTimer();
    setState("ready");
    setError(null);
    setTranscript([]);
    setElapsed(0);
    setLevel(0);
    setMuted(false);
  }, [stopMetering, stopTimer]);

  return {
    state,
    error,
    level,
    muted,
    elapsed,
    transcript,
    isSimulated,
    language,
    start,
    setLanguage,
    end,
    toggleMute,
    reset,
  };
}
