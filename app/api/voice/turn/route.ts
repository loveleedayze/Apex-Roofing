import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { routeLeadTurn } from "@/lib/leadRouting";
import { recordClaudeSuccess, recordClaudeFailure, getHealth } from "@/lib/health";
import {
  MODEL,
  END_CALL_MARKER,
  buildVoiceSystemPrompt,
  conversationLanguage,
  detectIntent,
  detectLanguage,
  speakable,
  spokenGreeting,
  spokenFallback,
  spokenReprompt,
  spokenSignoff,
  spokenSwitched,
  numberWordsToDigits,
  isLang,
  LANGS,
  LANGUAGE_NAME,
} from "@/lib/maggie";
import type { Lang, TranscriptItem } from "@/lib/maggie";

// POST /api/voice/turn
//
// One request per caller utterance on a BROWSER call. The page does the
// listening and the speaking with the browser's own speech APIs; this route
// owns everything that must not live in a browser tab — the prompt, the API
// key, the language decision, and the lead.
//
// Why the language decision is made here and not in the widget: the answer
// picks which speech recognizer hears the next sentence and which voice says
// it. That has to agree with the language Maggie is actually writing in, and
// only the side holding the prompt knows that. The widget asks; the server
// decides; the widget points its engines wherever it's told.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A runaway-loop guard, not a UX limit. Matches the phone transport. */
const MAX_TURNS = 25;

interface TurnBody {
  transcript?: TranscriptItem[];
  heard?: string;
  /** Where the widget currently has its engines pointed. */
  language?: Lang;
  leadId?: string;
  leadMissing?: string[];
  /** True on hangup: last chance to read the conversation into a lead. */
  finalize?: boolean;
  /** Set on the first turn after the caller taps a language button. */
  chosenLanguage?: Lang;
}

export async function POST(req: Request) {
  let body: TurnBody;
  try {
    body = (await req.json()) as TurnBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const transcript = Array.isArray(body.transcript) ? body.transcript : [];
  const heard = String(body.heard || "").trim();
  const requested: Lang = isLang(body.language) ? body.language : "en";
  // The caller pressed a language button on the call screen. That's a direct
  // instruction, not a guess, so it overrides what the transcript suggests —
  // until they actually speak another language.
  const chosen = isLang(body.chosenLanguage) ? body.chosenLanguage : undefined;

  // The conversation's language, with the widget's current setting as the
  // fallback for turns that carry no signal ("okay", "1420", a name). It only
  // moves when the caller actually gives us a reason to move it.
  const lang = chosen
    ? (detectLanguage(heard) ?? chosen)
    : conversationLanguage(transcript, heard, requested);

  // --- Hangup --------------------------------------------------------------
  // Nothing to say; everything to save.
  if (body.finalize) {
    const lead = await finalizeLead(transcript, heard, lang, body);
    return NextResponse.json({ ok: true, speech: "", endCall: true, language: lang, ...lead });
  }

  // --- The opening line ----------------------------------------------------
  // Static, and deliberately not a model call: the first turn is where latency
  // is most obvious, and a caller should never hear silence after pressing
  // call. She opens in English unless the caller picked a language; after
  // that she follows whatever they speak.
  if (!transcript.length && !heard) {
    return NextResponse.json({
      ok: true,
      speech: spokenGreeting(lang),
      endCall: false,
      language: lang,
      // The handful of lines the widget says on its own — when it hears
      // silence, and when it gives up on an empty room. Sent from here, in
      // both languages, so every word Maggie speaks is tuned in one place.
      phrases: {
        reprompt: Object.fromEntries(LANGS.map((l) => [l, spokenReprompt(l)])),
        signoff: Object.fromEntries(LANGS.map((l) => [l, spokenSignoff(l)])),
        switched: Object.fromEntries(LANGS.map((l) => [l, spokenSwitched(l)])),
      },
      mode: getHealth().mode,
    });
  }

  if (!heard) {
    return NextResponse.json({ ok: false, error: "Nothing heard" }, { status: 400 });
  }

  const { speech, endCall } = await generateSpokenReply(transcript, heard, lang);

  // If Maggie answered in the other language — the caller's words were too
  // garbled for the detector but plain enough for Claude — follow her, so the
  // voice and the recognizer move with the conversation rather than a turn
  // behind it.
  const spokenLang = detectLanguage(speech) || lang;

  // --- The lead ------------------------------------------------------------
  // Cheap gate: reading the transcript costs a model call, so we don't do it
  // every turn. We do it once a phone number has appeared (the crew can work
  // with that alone, even if the tab closes mid-sentence) and again at hangup.
  const full = [...transcript, { role: "user" as const, text: heard }];
  // Number words count too: "오 공 구 ...", "五零九 ...", "năm không chín ..."
  // are phone numbers.
  // Seven digits, however they're grouped: "509, 555, 0142" has commas.
  const hasNumber = /\d(?:[\s().,，、-]*\d){6,}/.test(numberWordsToDigits(full.map((t) => t.text).join(" ")));
  let lead: Partial<Awaited<ReturnType<typeof finalizeLead>>> = {};

  if (hasNumber || body.leadId) {
    const routed = await routeLeadTurn({
      source: "maggie_voice",
      transcript: full,
      contact: {},
      leadId: body.leadId,
      leadMissing: body.leadMissing,
      language: LANGUAGE_NAME[spokenLang],
      channel: "maggie_ai_receptionist_web_call",
      extra: { turns: full.filter((t) => t.role === "user").length },
    });
    lead = { leadId: routed.leadId, leadMissing: routed.leadMissing, priority: routed.priority };
  }

  const turns = full.filter((t) => t.role === "user").length;

  return NextResponse.json({
    ok: true,
    speech,
    endCall: endCall || turns >= MAX_TURNS,
    language: spokenLang,
    mode: getHealth().mode,
    ...lead,
  });
}

/**
 * Maggie's next spoken line. Claude when configured; short scripted lines when
 * not, or when the API call fails — a caller must never hear silence because
 * an API key expired, and a Spanish-speaking caller must not be dropped into
 * English at the moment something breaks.
 */
async function generateSpokenReply(
  transcript: TranscriptItem[],
  heard: string,
  lang: Lang,
): Promise<{ speech: string; endCall: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback = () => ({ speech: spokenFallback(detectIntent(heard), lang), endCall: false });

  if (!apiKey) return fallback();

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      // A spoken turn is one or two sentences. Capping this also caps the
      // caller's wait — a long answer is a bug on a call, not a feature.
      max_tokens: 200,
      thinking: { type: "disabled" },
      system: buildVoiceSystemPrompt(undefined, lang),
      messages: toClaudeTurns(transcript, heard),
    });

    const raw = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text?.trim();
    if (!raw) {
      recordClaudeFailure(new Error("Claude returned an empty response"));
      return fallback();
    }
    recordClaudeSuccess();

    const endCall = raw.includes(END_CALL_MARKER);
    // speakable() is the belt to the prompt's braces: a stray asterisk read
    // aloud on a customer call is not a recoverable mistake.
    const speech = speakable(raw.split(END_CALL_MARKER).join("").trim());
    if (speech) return { speech, endCall };

    // The marker was the whole reply. Still say something before hanging up.
    return {
      speech: {
        en: "Thanks for calling. We'll be in touch shortly. Goodbye.",
        es: "Gracias por llamar. Lo contactamos muy pronto. Que tenga buen día.",
        ko: "전화 주셔서 감사합니다. 곧 연락드릴게요. 좋은 하루 되세요.",
        vi: "Dạ, cảm ơn anh chị đã gọi. Tụi em sẽ liên lạc lại sớm. Chào anh chị ạ.",
        zh: "感谢您的来电，我们会尽快联系您。再见。",
      }[lang],
      endCall,
    };
  } catch (err) {
    recordClaudeFailure(err);
    console.error("[maggie:web-call] stack trace:", err);
    return fallback();
  }
}

async function finalizeLead(
  transcript: TranscriptItem[],
  heard: string,
  lang: Lang,
  body: TurnBody,
) {
  const full = heard ? [...transcript, { role: "user" as const, text: heard }] : transcript;

  // A hangup during the greeting is not a lead.
  if (!full.some((t) => t.role === "user")) {
    return { leadId: undefined, leadMissing: [] as string[] };
  }

  const routed = await routeLeadTurn({
    source: "maggie_voice",
    transcript: full,
    contact: {},
    leadId: body.leadId,
    leadMissing: body.leadMissing,
    language: LANGUAGE_NAME[lang],
    channel: "maggie_ai_receptionist_web_call",
    finalize: true,
    extra: {
      turns: full.filter((t) => t.role === "user").length,
      endedAt: new Date().toISOString(),
    },
  });

  console.log(
    `[maggie:web-call] call finished in ${lang} — lead ${routed.leadId} (${routed.priority})` +
      `${routed.leadMissing.length ? `, still missing ${routed.leadMissing.join(", ")}` : ", complete"}`,
  );

  return { leadId: routed.leadId, leadMissing: routed.leadMissing, priority: routed.priority };
}

/** Claude requires the first message to be from the user; Maggie greeted first. */
function toClaudeTurns(transcript: TranscriptItem[], heard: string): Anthropic.MessageParam[] {
  const mapped: Anthropic.MessageParam[] = [...transcript, { role: "user" as const, text: heard }].map(
    (t) => ({
      role: t.role === "maggie" ? ("assistant" as const) : ("user" as const),
      content: t.text,
    }),
  );
  while (mapped.length && mapped[0].role === "assistant") mapped.shift();
  if (!mapped.length) mapped.push({ role: "user", content: heard || "Hello" });
  return mapped;
}
