// ---------------------------------------------------------------------------
// Voice client contract — the seam between the widget and a WebRTC vendor
// ---------------------------------------------------------------------------
// The call widget knows nothing about Vapi, Retell, LiveKit, or Daily. It
// knows this interface. Swapping vendors — or moving off one that raises its
// prices — means writing one adapter, not touching the UI.
//
// Three adapters ship here:
//   createDemoVoiceClient   — works right now, no credentials, no SDK. This is
//                             the default, so the widget is demonstrable to a
//                             client before any account exists.
//   createVapiVoiceClient   — Vapi (vapi.ai)
//   createRetellVoiceClient — Retell AI (retellai.com)
//
// The two real adapters need their vendor SDK installed. Rather than importing
// a package that isn't in package.json (which would break the build for
// everyone else), they take a `loadSdk` function. Wiring one up is two lines —
// see VOICE.md, "Plugging in a real voice provider".
// ---------------------------------------------------------------------------

export type TranscriptRole = "maggie" | "caller";

export interface TranscriptLine {
  role: TranscriptRole;
  text: string;
  /** False while the vendor is still revising its guess at what was said. */
  final: boolean;
}

/** Everything the widget wants to hear about while a call is running. */
export interface VoiceClientHandlers {
  /** The media session is up and audio is flowing both ways. */
  onConnected?: () => void;
  /** The call ended — normally, or because the far end dropped it. */
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  /**
   * Speaking loudness, 0..1. Optional: when a vendor doesn't report it the
   * widget meters the caller's own microphone instead, so the wave always
   * moves.
   */
  onVolume?: (level: number) => void;
  onTranscript?: (line: TranscriptLine) => void;
}

/** Languages the call widget offers buttons for. Matches Lang in lib/maggie.ts. */
export type CallLanguage = "en" | "es" | "ko" | "vi" | "zh";

const CALL_LANGS: readonly CallLanguage[] = ["en", "es", "ko", "vi", "zh"];

export interface VoiceClient {
  /** Human-readable, shown in dev warnings and the demo badge. */
  readonly provider: string;
  /** True when this client is a local simulation, not a real call. */
  readonly isSimulated: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  setMuted(muted: boolean): void;
  /**
   * The caller picked a language on the call screen. Optional: vendors that
   * detect language on their own needn't implement it.
   */
  setLanguage?(lang: CallLanguage): void;
}

/**
 * How the widget obtains a client. Pass your own to `<MaggieCall createClient>`
 * to use a vendor not covered here — that's the whole extension point.
 */
export type VoiceClientFactory = (
  handlers: VoiceClientHandlers,
  options?: { language?: CallLanguage },
) => Promise<VoiceClient>;

export interface ProviderConfig {
  /** Vendor public/publishable key. Safe to expose; never put a secret key here. */
  publicKey?: string;
  /** Which assistant/agent to connect the caller to. */
  assistantId?: string;
  /**
   * Loads the vendor SDK. Keeps an uninstalled package out of the build:
   *   loadSdk: () => import("@vapi-ai/web")
   */
  loadSdk?: () => Promise<any>;
}

function requireSdk(config: ProviderConfig, pkg: string): () => Promise<any> {
  if (config.loadSdk) return config.loadSdk;
  return () => {
    throw new Error(
      `Voice SDK not wired up. Run "npm install ${pkg}", then pass ` +
        `loadSdk: () => import("${pkg}") into the provider config. See VOICE.md.`,
    );
  };
}

// ---------------------------------------------------------------------------
// Demo adapter — no credentials, no network, no SDK
// ---------------------------------------------------------------------------
// This exists so the widget is never a dead button. A prospect can click it in
// a sales call today and see the whole flow: connecting, live wave, captions,
// hangup. It is clearly labelled as a simulation in the UI, because a demo that
// quietly pretends to be a working product is how you lose a client's trust in
// the meeting after this one.

const DEMO_SCRIPT: Array<{ role: TranscriptRole; text: string; at: number }> = [
  { role: "maggie", text: "Thanks for calling Apex Roofing, this is Maggie Mae. What's going on with your roof?", at: 300 },
  { role: "caller", text: "We had hail last night and there's a stain spreading on the ceiling.", at: 5200 },
  { role: "maggie", text: "Oh no — that's storm damage and it's time-sensitive. We can get someone out today. What's your name?", at: 8000 },
  { role: "caller", text: "Dana Whitfield.", at: 13000 },
  { role: "maggie", text: "Thanks, Dana. And the address of the property?", at: 15200 },
];

export function createDemoVoiceClient(): VoiceClientFactory {
  return async (handlers) => {
    let timers: ReturnType<typeof setTimeout>[] = [];
    let wave: ReturnType<typeof setInterval> | null = null;
    let muted = false;
    let stopped = false;

    const clearAll = () => {
      timers.forEach(clearTimeout);
      timers = [];
      if (wave) clearInterval(wave);
      wave = null;
    };

    return {
      provider: "demo",
      isSimulated: true,

      async start() {
        // A beat of latency, so the connecting state is actually visible.
        timers.push(
          setTimeout(() => {
            if (stopped) return;
            handlers.onConnected?.();

            // A drifting, speech-shaped level so the wave looks alive rather
            // than like a random-number generator.
            let phase = 0;
            wave = setInterval(() => {
              phase += 0.35;
              const envelope = (Math.sin(phase) + 1) / 2;
              const jitter = Math.random() * 0.35;
              handlers.onVolume?.(muted ? 0 : Math.min(1, envelope * 0.6 + jitter));
            }, 90);

            DEMO_SCRIPT.forEach((line) => {
              timers.push(
                setTimeout(() => {
                  handlers.onTranscript?.({ role: line.role, text: line.text, final: true });
                }, line.at),
              );
            });
          }, 1400),
        );
      },

      async stop() {
        stopped = true;
        clearAll();
        handlers.onDisconnected?.();
      },

      setMuted(next) {
        muted = next;
      },
    };
  };
}

// ---------------------------------------------------------------------------
// Browser adapter — the browser's own speech engines, no vendor, no per-minute
// ---------------------------------------------------------------------------
// SpeechRecognition listens, speechSynthesis speaks, and /api/voice/turn does
// the thinking. No SDK, no account, no per-minute billing: the two speech
// engines ship with the browser.
//
// Worth knowing before this goes on a client's site:
//   - Chrome and Edge implement SpeechRecognition by streaming microphone
//     audio to Google's servers. "Built-in" is not the same as "on-device".
//     Safari behaves similarly with Apple. Say so on a privacy page if the
//     client's customers would care.
//   - Firefox does not implement it at all. `start()` throws a clear error
//     there rather than failing silently, and the widget shows it.
//   - It needs HTTPS (localhost excepted).
//   - It is half-duplex: we stop listening while Maggie speaks, because an
//     open mic next to a speaker transcribes her own voice back at her. So
//     there is no barge-in — the caller can't cut her off mid-sentence.
//
// The language decision belongs to the server, not to this file: it holds the
// prompt, so only it knows which language Maggie actually answered in. Every
// turn comes back stamped with a language, and this adapter points the
// recognizer and the voice wherever it's told — mid-call, as often as the
// caller switches.

export interface BrowserVoiceConfig {
  /** Server route that turns "what was heard" into "what to say". */
  endpoint?: string;
  /** Language Maggie opens in. She follows the caller after that. */
  openIn?: CallLanguage;
  /** Consecutive silences before we assume the caller has walked away. */
  maxSilences?: number;
}

/** The slice of the SpeechRecognition API we use. Not in TypeScript's DOM lib. */
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => RecognitionLike;

type Phrases = Record<"reprompt" | "signoff" | "switched", Record<string, string>>;

/** Speech tag for each language — the recognizer and the voice both use it. */
const SPEECH_TAG: Record<CallLanguage, string> = {
  en: "en-US",
  es: "es-US",
  ko: "ko-KR",
  vi: "vi-VN",
  zh: "zh-CN", // Mandarin
};

/** Preferred voice regions, best first. US variants for a US business. */
const VOICE_REGIONS: Record<CallLanguage, string[]> = {
  en: ["en-us"],
  es: ["es-us", "es-mx", "es-419"],
  ko: ["ko-kr"],
  vi: ["vi-vn"],
  // Mainland Mandarin first, then Taiwan Mandarin. A Cantonese voice reading
  // Mandarin text is the last resort.
  zh: ["zh-cn", "zh-tw"],
};

export function asCallLanguage(value: unknown): CallLanguage | null {
  return (CALL_LANGS as readonly unknown[]).includes(value) ? (value as CallLanguage) : null;
}

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function bcp47(lang: CallLanguage): string {
  return SPEECH_TAG[lang];
}

/**
 * The best available voice for a language. Chrome populates the list
 * asynchronously, so this is called per utterance rather than cached at start.
 */
function pickVoice(lang: CallLanguage): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
  if (!matching.length) return undefined;
  // Prefer the American variant where there is one — this is a US roofing
  // company — then a local (non-network) voice, which starts speaking sooner.
  for (const tag of VOICE_REGIONS[lang]) {
    const hit = matching.find((v) => v.lang.toLowerCase().replace("_", "-") === tag);
    if (hit) return hit;
  }
  return matching.find((v) => v.localService) || matching[0];
}

/** Resolves once the browser has actually loaded its voice list. */
function voicesReady(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return resolve();
    if (window.speechSynthesis.getVoices().length) return resolve();
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      resolve();
    };
    window.speechSynthesis.addEventListener("voiceschanged", done);
    // Some browsers never fire the event. Never hang the call on cosmetics.
    setTimeout(done, 1000);
  });
}

export function createBrowserVoiceClient(config: BrowserVoiceConfig = {}): VoiceClientFactory {
  const endpoint = config.endpoint || "/api/voice/turn";
  const maxSilences = config.maxSilences ?? 2;

  return async (handlers, options) => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      throw new Error(
        "This browser can't run Maggie's built-in voice. Chrome, Edge, or Safari can — or type to her in the chat instead.",
      );
    }

    /** Everything said so far. Sent up each turn; the server holds no session. */
    const history: Array<{ role: "maggie" | "user"; text: string }> = [];
    // A language the caller picked before pressing call wins over the site
    // default. Either way she follows the caller once they start talking.
    const picked = asCallLanguage(options?.language);
    let lang: CallLanguage = picked || asCallLanguage(config.openIn) || "en";
    /** The caller's own pick, sent with each turn until they speak another
     *  language — the transcript alone would pull the call back to English. */
    let chosen: CallLanguage | undefined = picked || undefined;
    let phrases: Phrases | null = null;
    let leadId: string | undefined;
    let leadMissing: string[] | undefined;

    let recognition: RecognitionLike | null = null;
    let stopped = false;
    let muted = false;
    let speaking = false;
    let silences = 0;

    const say = (role: "maggie" | "user", text: string, final: boolean) =>
      handlers.onTranscript?.({ role: role === "maggie" ? "maggie" : "caller", text, final });

    // --- speaking ----------------------------------------------------------

    const speak = async (text: string): Promise<void> => {
      if (!text || stopped) return;
      await voicesReady();
      speaking = true;
      try {
        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = bcp47(lang);
          const voice = pickVoice(lang);
          if (voice) utterance.voice = voice;
          // This device has voices, just none in this language (Vietnamese
          // is missing from desktop Chrome, for one). An English voice
          // reading Vietnamese is gibberish, so stay quiet: the words are
          // already on screen. Give the caller time to read them.
          if (!voice && lang !== "en" && window.speechSynthesis.getVoices().length) {
            setTimeout(resolve, Math.min(1500 + text.length * 60, 9000));
            return;
          }
          utterance.rate = 1.02; // receptionist brisk, not hurried

          // Chrome sometimes never fires either event — a known bug that
          // otherwise leaves the call with nobody listening and nobody
          // talking. Whichever happens first wins, and the caller gets their
          // turn back either way.
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            clearTimeout(guard);
            resolve();
          };
          const guard = setTimeout(done, 4000 + text.length * 90);

          utterance.onend = done;
          utterance.onerror = done;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        });
      } finally {
        speaking = false;
      }
    };

    // --- the server turn ---------------------------------------------------

    const post = async (payload: Record<string, unknown>) => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang, chosenLanguage: chosen, leadId, leadMissing, ...payload }),
      });
      if (!res.ok) throw new Error(`Maggie's line dropped (${res.status}).`);
      return res.json();
    };

    const applyTurn = (data: any) => {
      // The server's language is authoritative: it knows which language the
      // words it just wrote are in. Both engines follow it on the next turn.
      const next = asCallLanguage(data.language);
      if (next) {
        // They spoke a different language than the one they picked: the
        // pick has done its job, and from here she follows them again.
        if (chosen && next !== chosen) chosen = undefined;
        lang = next;
      }
      if (data.leadId) leadId = data.leadId;
      if (Array.isArray(data.leadMissing)) leadMissing = data.leadMissing;
    };

    const sendTurn = async (heard: string) => {
      if (stopped) return;
      try {
        const data = await post({ transcript: history, heard });
        history.push({ role: "user", text: heard });
        applyTurn(data);

        if (data.speech) {
          history.push({ role: "maggie", text: data.speech });
          say("maggie", data.speech, true);
          await speak(data.speech);
        }

        if (data.endCall) return void (await stopCall());
        listen();
      } catch (err) {
        handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
        await stopCall();
      }
    };

    // --- listening ---------------------------------------------------------

    const listen = () => {
      // Never open the mic while she's talking: it's one room, and the
      // recognizer would transcribe her own voice straight back at her. The
      // listen() call after speak() picks it up instead.
      if (stopped || muted || speaking) return;

      const rec = new Ctor();
      recognition = rec;
      rec.lang = bcp47(lang); // the switch that makes her actually multilingual
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      let finalText = "";

      rec.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript || "";
          if (result.isFinal) finalText += text;
          else interim += text;
        }
        if (interim.trim()) say("user", interim.trim(), false);
        if (finalText.trim()) say("user", finalText.trim(), true);
      };

      rec.onerror = (event: any) => {
        const code = event?.error;
        if (code === "no-speech" || code === "aborted") return; // handled in onend
        if (code === "not-allowed" || code === "service-not-allowed") {
          handlers.onError?.(
            new Error("Microphone access was blocked, so Maggie can't hear you."),
          );
          void stopCall();
          return;
        }
        if (code === "network") {
          handlers.onError?.(new Error("Speech recognition lost its connection."));
          void stopCall();
        }
      };

      rec.onend = () => {
        if (stopped || recognition !== rec) return;
        recognition = null;

        const heard = finalText.trim();
        if (heard) {
          silences = 0;
          void sendTurn(heard);
          return;
        }

        // Nothing said: they're thinking, on mute, or gone.
        silences += 1;
        if (silences > maxSilences) {
          void (async () => {
            await speak(phrase("signoff"));
            await stopCall();
          })();
          return;
        }
        void (async () => {
          const line = phrase("reprompt");
          say("maggie", line, true);
          history.push({ role: "maggie", text: line });
          await speak(line);
          listen();
        })();
      };

      try {
        rec.start();
      } catch {
        // start() throws if a previous recognition hasn't fully released the
        // mic. A beat later it succeeds.
        setTimeout(() => {
          if (!stopped && !muted) {
            try {
              rec.start();
            } catch {
              /* give up on this turn rather than the call */
            }
          }
        }, 250);
      }
    };

    /** Short spoken copy, in the current language, as the server worded it. */
    const phrase = (key: keyof Phrases): string =>
      phrases?.[key]?.[lang] || FALLBACK_PHRASES[key][lang];

    // --- hangup ------------------------------------------------------------

    const finalizePayload = () =>
      JSON.stringify({ transcript: history, language: lang, leadId, leadMissing, finalize: true });

    /**
     * The tab is closing. `fetch` gets cancelled on unload; a beacon doesn't.
     * Without this, hanging up by closing the tab loses the lead.
     */
    const beaconFinalize = () => {
      if (!history.some((t) => t.role === "user")) return;
      try {
        navigator.sendBeacon?.(
          endpoint,
          new Blob([finalizePayload()], { type: "application/json" }),
        );
      } catch {
        /* nothing more we can do from a closing tab */
      }
    };

    const stopCall = async () => {
      if (stopped) return;
      stopped = true;
      window.removeEventListener("pagehide", beaconFinalize);

      try {
        recognition?.abort();
      } catch {
        /* already gone */
      }
      recognition = null;
      window.speechSynthesis?.cancel();

      // Read the whole conversation into the lead. keepalive so it survives
      // the widget being torn down on the next line.
      if (history.some((t) => t.role === "user")) {
        try {
          await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: finalizePayload(),
            keepalive: true,
          });
        } catch (err) {
          console.error("[maggie:web-call] could not finalize the lead:", err);
        }
      }

      handlers.onDisconnected?.();
    };

    return {
      provider: "browser",
      isSimulated: false,

      async start() {
        window.addEventListener("pagehide", beaconFinalize);

        // The opening line is a static string on the server, so this is one
        // fast round trip rather than a model call. It also hands back the
        // short spoken phrases, keeping every word Maggie says on the server
        // where the client is tuned.
        const data = await post({ transcript: [], heard: "" });
        applyTurn(data);
        if (data.phrases) phrases = data.phrases as Phrases;

        handlers.onConnected?.();

        history.push({ role: "maggie", text: data.speech });
        say("maggie", data.speech, true);
        await speak(data.speech);
        listen();
      },

      async stop() {
        await stopCall();
      },

      setMuted(next) {
        muted = next;
        if (next) {
          try {
            recognition?.abort();
          } catch {
            /* already gone */
          }
          recognition = null;
        } else if (!stopped) {
          listen();
        }
      },

      setLanguage(next) {
        if (stopped || next === lang) return;
        lang = next;
        chosen = next;
        // Drop whatever the old-language recognizer was half-hearing, say so in
        // the new language, and listen again with the new one. If she's
        // mid-sentence, cancelling her lets her current turn finish into the
        // listen() that follows it, which now uses the new language anyway.
        const rec = recognition;
        recognition = null;
        try {
          rec?.abort();
        } catch {
          /* already gone */
        }
        if (speaking) return;
        void (async () => {
          const line = phrase("switched");
          say("maggie", line, true);
          history.push({ role: "maggie", text: line });
          await speak(line);
          listen();
        })();
      },
    };
  };
}

/** Used only if the server's phrase table never arrived. */
const FALLBACK_PHRASES: Record<keyof Phrases, Record<CallLanguage, string>> = {
  reprompt: {
    en: "Sorry, I didn't catch that. Could you say it again?",
    es: "Perdón, no le escuché bien. ¿Me lo puede repetir?",
    ko: "죄송해요, 잘 못 들었어요. 다시 한 번 말씀해 주시겠어요?",
    vi: "Dạ xin lỗi, em nghe chưa rõ. Anh chị nói lại giúp em được không ạ?",
    zh: "不好意思，我没听清楚。您能再说一遍吗？",
  },
  signoff: {
    en: "I can't hear you, so I'll let you go. Goodbye.",
    es: "No lo escucho, así que lo dejo ir. Que tenga buen día.",
    ko: "말씀이 들리지 않아서 이만 끊을게요. 좋은 하루 되세요.",
    vi: "Em không nghe được anh chị nói, nên em xin phép cúp máy. Chào anh chị ạ.",
    zh: "我听不到您的声音，先挂断了。再见。",
  },
  switched: {
    en: "Sure, we can keep going in English. Go ahead.",
    es: "Claro, seguimos en español. Dígame.",
    ko: "네, 한국어로 도와드릴게요. 말씀하세요.",
    vi: "Dạ, mình nói tiếng Việt nhé. Anh chị cứ nói ạ.",
    zh: "好的，我们用中文说。请讲。",
  },
};

// ---------------------------------------------------------------------------
// Vapi adapter
// ---------------------------------------------------------------------------
// Usage:
//   createVapiVoiceClient({
//     publicKey: process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY,
//     assistantId: process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID,
//     loadSdk: () => import("@vapi-ai/web"),
//   })
//
// Written against Vapi's documented web SDK (a `Vapi` default export with
// `.start(assistantId)`, `.stop()`, `.setMuted()` and `call-start`,
// `call-end`, `error`, `volume-level`, `message` events). Verify against
// their current docs when you wire it up — vendor SDKs move.

export function createVapiVoiceClient(config: ProviderConfig): VoiceClientFactory {
  const load = requireSdk(config, "@vapi-ai/web");

  return async (handlers) => {
    if (!config.publicKey) throw new Error("Vapi public key missing (NEXT_PUBLIC_VAPI_PUBLIC_KEY).");
    if (!config.assistantId) throw new Error("Vapi assistant id missing (NEXT_PUBLIC_VAPI_ASSISTANT_ID).");

    const mod = await load();
    const Vapi = mod.default ?? mod;
    const vapi = new Vapi(config.publicKey);

    vapi.on("call-start", () => handlers.onConnected?.());
    vapi.on("call-end", () => handlers.onDisconnected?.());
    vapi.on("error", (err: unknown) =>
      handlers.onError?.(err instanceof Error ? err : new Error(String(err))),
    );
    vapi.on("volume-level", (level: number) => handlers.onVolume?.(level));
    vapi.on("message", (msg: any) => {
      if (msg?.type !== "transcript" || !msg.transcript) return;
      handlers.onTranscript?.({
        role: msg.role === "assistant" ? "maggie" : "caller",
        text: msg.transcript,
        final: msg.transcriptType === "final",
      });
    });

    return {
      provider: "vapi",
      isSimulated: false,
      async start() {
        await vapi.start(config.assistantId);
      },
      async stop() {
        await vapi.stop();
      },
      setMuted(muted) {
        vapi.setMuted(muted);
      },
    };
  };
}

// ---------------------------------------------------------------------------
// Retell AI adapter
// ---------------------------------------------------------------------------
// Retell mints a short-lived access token server-side — its API key must never
// reach the browser. `tokenEndpoint` is your own route that creates the web
// call and returns { accessToken }. A stub lives at
// app/api/voice/web-session/route.ts.
//
// Same caveat as Vapi: check the current SDK surface when you wire it up.

export interface RetellConfig extends ProviderConfig {
  /** Your server route that returns { accessToken }. */
  tokenEndpoint?: string;
}

export function createRetellVoiceClient(config: RetellConfig): VoiceClientFactory {
  const load = requireSdk(config, "retell-client-js-sdk");
  const tokenEndpoint = config.tokenEndpoint || "/api/voice/web-session";

  return async (handlers) => {
    const mod = await load();
    const RetellWebClient = mod.RetellWebClient ?? mod.default;
    const client = new RetellWebClient();

    client.on("call_started", () => handlers.onConnected?.());
    client.on("call_ended", () => handlers.onDisconnected?.());
    client.on("error", (err: unknown) =>
      handlers.onError?.(err instanceof Error ? err : new Error(String(err))),
    );
    client.on("update", (update: any) => {
      const last = update?.transcript?.[update.transcript.length - 1];
      if (!last?.content) return;
      handlers.onTranscript?.({
        role: last.role === "agent" ? "maggie" : "caller",
        text: last.content,
        final: true,
      });
    });

    return {
      provider: "retell",
      isSimulated: false,
      async start() {
        const res = await fetch(tokenEndpoint, { method: "POST" });
        if (!res.ok) {
          throw new Error(
            `Could not start the call session (${res.status} from ${tokenEndpoint}).`,
          );
        }
        const { accessToken } = await res.json();
        if (!accessToken) throw new Error(`${tokenEndpoint} returned no accessToken.`);
        await client.startCall({ accessToken });
      },
      async stop() {
        client.stopCall();
      },
      setMuted(muted) {
        // Retell exposes mute/unmute rather than a setter.
        if (muted) client.mute?.();
        else client.unmute?.();
      },
    };
  };
}

// ---------------------------------------------------------------------------
// Provider selection
// ---------------------------------------------------------------------------

/**
 * Picks an adapter from NEXT_PUBLIC_VOICE_PROVIDER: browser | vapi | retell |
 * demo. Defaults to the demo client, so an unconfigured deployment shows a
 * working simulation instead of a broken button — set it to `browser` to run
 * real calls on the browser's own speech engines, with no vendor account.
 *
 * These must be read as full literal expressions, not
 * `process.env[name]` — Next.js inlines NEXT_PUBLIC_* vars at build time by
 * exact textual match.
 */
export function resolveVoiceClientFactory(): VoiceClientFactory {
  const provider = (process.env.NEXT_PUBLIC_VOICE_PROVIDER || "demo").toLowerCase();

  switch (provider) {
    case "browser":
    case "webspeech":
      return createBrowserVoiceClient({
        openIn: asCallLanguage(process.env.NEXT_PUBLIC_VOICE_OPEN_IN) || "en",
      });
    case "vapi":
      return createVapiVoiceClient({
        publicKey: process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY,
        assistantId: process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID,
        // Uncomment after `npm install @vapi-ai/web`:
        // loadSdk: () => import("@vapi-ai/web"),
      });
    case "retell":
      return createRetellVoiceClient({
        // Uncomment after `npm install retell-client-js-sdk`:
        // loadSdk: () => import("retell-client-js-sdk"),
      });
    default:
      return createDemoVoiceClient();
  }
}
