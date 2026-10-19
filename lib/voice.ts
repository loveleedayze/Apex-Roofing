// ---------------------------------------------------------------------------
// Maggie Mae on the phone — the voice layer
// ---------------------------------------------------------------------------
// Twilio calls our webhook, we answer with TwiML (an XML script telling Twilio
// what to say and what to listen for). One caller utterance = one HTTP round
// trip. Twilio does the speech-to-text and the text-to-speech; Claude does the
// thinking; lib/crm.ts routes the lead. Same brain and same pipeline as the
// chat widget — only the transport is different.
//
// Why this shape and not a realtime media stream: Twilio's <Gather> works on
// plain serverless HTTP, which is what this app already is. Streaming audio
// (Twilio ConversationRelay or Media Streams) gives lower latency and lets the
// caller interrupt mid-sentence, but it needs a always-on websocket server —
// a different host, not Vercel. The seam is deliberate: everything below the
// TwiML helpers is transport-agnostic, so moving to streaming later means
// rewriting this file's top half and nothing else.
// ---------------------------------------------------------------------------

import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import {
  MODEL,
  END_CALL_MARKER,
  buildVoiceSystemPrompt,
  detectIntent,
  extractContact,
  spokenGreeting,
  spokenFallback,
  spokenReprompt,
  speakable,
} from "@/lib/maggie";
import { normalizeLead, dispatchToCRMs } from "@/lib/crm";
import { recordClaudeSuccess, recordClaudeFailure } from "@/lib/health";
import { site } from "@/lib/site";
import type { CallSession } from "@/lib/callStore";
import { saveSession } from "@/lib/callStore";

// --- Tunables -------------------------------------------------------------

/** Twilio TTS voice. Amazon Polly neural voices sound the least robotic. */
export const VOICE = process.env.TWILIO_VOICE || "Polly.Joanna-Neural";
export const LANGUAGE = process.env.TWILIO_LANGUAGE || "en-US";

/** Hard stop on conversation length — a guard against a stuck loop, not a UX limit. */
const MAX_TURNS = 25;
/** Consecutive silent gathers before we assume the caller is gone. */
const MAX_EMPTY_TURNS = 2;

// --- TwiML ----------------------------------------------------------------

/** TwiML is XML. An unescaped & or < in a caller's name breaks the whole call. */
export function escapeXml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// `speakable` now lives in lib/maggie.ts, next to the prompt that promises not
// to emit markdown in the first place, so the browser call widget gets the
// same scrubbing this file has always applied. Re-exported here because that
// is where this file's callers have always found it.
export { speakable };

export function twiml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

export function say(text: string): string {
  return `<Say voice="${VOICE}" language="${LANGUAGE}">${escapeXml(speakable(text))}</Say>`;
}

/**
 * Speak a line, then listen. The <Say> is nested inside <Gather> so Twilio is
 * already listening while Maggie talks — the caller can cut her off instead of
 * waiting politely through a sentence they don't need.
 *
 * If the gather hears nothing it falls through to the verbs after it, which is
 * how we detect silence: we redirect back with an empty SpeechResult.
 */
export function sayAndGather(text: string, actionUrl: string): Response {
  return twiml(
    `<Gather input="speech" action="${escapeXml(actionUrl)}" method="POST" ` +
      `speechTimeout="auto" speechModel="phone_call" enhanced="true" ` +
      `language="${LANGUAGE}" actionOnEmptyResult="true" profanityFilter="false">` +
      say(text) +
      `</Gather>` +
      // Reached only if Twilio never fires the action (rare). Keeps the call
      // moving instead of dropping the caller into silence.
      `<Redirect method="POST">${escapeXml(actionUrl)}</Redirect>`,
  );
}

export function sayAndHangup(text: string): Response {
  return twiml(say(text) + "<Hangup/>");
}

// --- Twilio request authenticity ------------------------------------------

/**
 * These webhooks are public URLs that create CRM leads and spend API credits.
 * Twilio signs every request; we verify it, so a stranger with the URL can't
 * fill the client's pipeline with garbage.
 *
 * The signature covers the exact URL Twilio requested plus every POST field,
 * sorted by key and concatenated. Behind Vercel's proxy the request URL we see
 * may not be the one Twilio called, so TWILIO_WEBHOOK_BASE_URL can pin it.
 */
export function verifyTwilioSignature(req: Request, params: Record<string, string>): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!authToken) {
    // No token configured — local development or a pre-Twilio demo. Allowed,
    // but never quietly: an unsigned production line is a real vulnerability.
    console.warn(
      "[maggie:voice] TWILIO_AUTH_TOKEN is not set — accepting this webhook WITHOUT verifying it came from Twilio. Do not run a live number this way.",
    );
    return true;
  }

  const signature = req.headers.get("x-twilio-signature");
  if (!signature) return false;

  const url = publicUrl(req);
  const payload =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");

  const expected = crypto.createHmac("sha1", authToken).update(Buffer.from(payload, "utf-8")).digest("base64");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  const ok = crypto.timingSafeEqual(a, b);
  if (!ok) {
    console.error(`[maggie:voice] REJECTED an unsigned/forged webhook for ${url}`);
  }
  return ok;
}

/** The URL as Twilio saw it, not as the proxy handed it to us. */
export function publicUrl(req: Request): string {
  const incoming = new URL(req.url);
  const base = process.env.TWILIO_WEBHOOK_BASE_URL?.replace(/\/$/, "");
  if (base) return base + incoming.pathname + incoming.search;

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || incoming.host;
  const proto = req.headers.get("x-forwarded-proto") || incoming.protocol.replace(":", "");
  return `${proto}://${host}${incoming.pathname}${incoming.search}`;
}

/** Twilio posts application/x-www-form-urlencoded; flatten it to a plain object. */
export async function readTwilioParams(req: Request): Promise<Record<string, string>> {
  const raw = await req.text();
  const params: Record<string, string> = {};
  new URLSearchParams(raw).forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

/** Absolute URL for one of our own voice endpoints, for TwiML action targets. */
export function voiceUrl(req: Request, path: string): string {
  const base = publicUrl(req);
  return new URL(path, base).toString();
}

// --- Maggie's spoken replies ----------------------------------------------

/** What Maggie says the moment she picks up. Static: latency is worst here. */
export function greeting(): string {
  // This transport speaks English only — one Polly voice, one Gather
  // language — so it always takes the English opener. The bilingual switching
  // lives in the browser call widget, which can change voice mid-call.
  return spokenGreeting("en");
}

export interface VoiceReply {
  speech: string;
  endCall: boolean;
}

/**
 * Maggie's next spoken line. Claude when configured; short canned lines when
 * not, or when the API call fails — a caller must never hear silence because
 * an API key expired.
 */
export async function generateVoiceReply(session: CallSession, heard: string): Promise<VoiceReply> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback = (): VoiceReply => ({
    speech: voiceFallback(detectIntent(heard)),
    endCall: false,
  });

  if (!apiKey) return fallback();

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      // A phone turn is one or two sentences. Capping this also caps the
      // caller's wait — a long answer is a bug on a voice line, not a feature.
      max_tokens: 200,
      thinking: { type: "disabled" },
      system: buildVoiceSystemPrompt(session.from),
      messages: toClaudeTurns(session, heard),
    });

    const raw = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text?.trim();
    if (!raw) {
      recordClaudeFailure(new Error("Claude returned an empty response"));
      return fallback();
    }
    recordClaudeSuccess();

    const endCall = raw.includes(END_CALL_MARKER);
    const speech = raw.split(END_CALL_MARKER).join("").trim();
    // If the marker was the entire reply, still say something before hanging up.
    return { speech: speech || "Thanks for calling. We'll be in touch shortly. Goodbye.", endCall };
  } catch (err) {
    recordClaudeFailure(err);
    console.error("[maggie:voice] stack trace:", err);
    return fallback();
  }
}

function toClaudeTurns(session: CallSession, heard: string): Anthropic.MessageParam[] {
  const turns = [...session.transcript, { role: "user" as const, text: heard }];
  const mapped: Anthropic.MessageParam[] = turns.map((t) => ({
    role: t.role === "maggie" ? ("assistant" as const) : ("user" as const),
    content: t.text,
  }));
  // Claude requires the first message to be from the user; Maggie greeted first.
  while (mapped.length && mapped[0].role === "assistant") mapped.shift();
  if (!mapped.length) mapped.push({ role: "user", content: heard || "Hello" });
  return mapped;
}

// The English-only scripted lines this transport falls back to. Written out
// loud, not read: short, one question, no markdown.
const voiceFallback = (intent: ReturnType<typeof detectIntent>) => spokenFallback(intent, "en");

// --- Turn-taking guards ----------------------------------------------------

export function shouldEndForLength(session: CallSession): boolean {
  return session.turns >= MAX_TURNS;
}

export function shouldEndForSilence(session: CallSession): boolean {
  return session.emptyTurns >= MAX_EMPTY_TURNS;
}

export const REPROMPT = spokenReprompt("en");

// --- Lead routing ----------------------------------------------------------

/**
 * Route the lead as soon as the caller says anything real.
 *
 * The chat widget waits for a phone number before routing. On the phone we
 * have one before "hello" — caller ID. So an urgent storm call reaches the
 * crew from the caller's first sentence, even if the line drops mid-word.
 * Name and address arrive later as an upsert under the same lead id.
 */
export async function ensureLeadRouted(session: CallSession, heard: string): Promise<void> {
  if (session.leadId) return;

  const intent = detectIntent(heard);
  const lead = normalizeLead(
    "maggie_voice",
    { phone: session.from },
    {
      intent,
      channel: "maggie_ai_receptionist_voice",
      callSid: session.callSid,
      calledNumber: session.to,
      priority: intent === "storm" ? "urgent" : "standard",
      transcript: [...session.transcript, { role: "user", text: heard }],
      note: "Live phone call in progress — details still being collected.",
    },
  );

  session.leadId = lead.id;
  await dispatchToCRMs(lead);
}

/**
 * The call is over. Read the whole transcript for name and address, then
 * upsert the lead so the CRM holds the finished record instead of a bare
 * phone number.
 *
 * Idempotent: <Hangup/> and Twilio's status callback both land here, and a
 * caller who hangs up mid-sentence triggers both at once.
 */
export async function finalizeCall(session: CallSession): Promise<void> {
  if (session.finalized) return;
  session.finalized = true;

  // A wrong number or a hang-up during the greeting is not a lead.
  if (session.turns === 0 && !session.leadId) {
    await saveSession(session);
    return;
  }

  const resolved = await extractContact(session.transcript, "", {
    // Caller ID is the number we trust; only an explicitly stated callback
    // number should ever replace it, and extractContact keeps that precedence.
    phone: session.from,
    ...session.contact,
  });
  session.contact = resolved;

  const spoken = session.transcript.map((t) => t.text).join(" ");
  const intent = detectIntent(spoken);

  const lead = normalizeLead(
    "maggie_voice",
    resolved,
    {
      intent,
      channel: "maggie_ai_receptionist_voice",
      callSid: session.callSid,
      calledNumber: session.to,
      priority: intent === "storm" ? "urgent" : "standard",
      transcript: session.transcript,
      startedAt: session.startedAt,
      endedAt: new Date().toISOString(),
      turns: session.turns,
    },
    session.leadId,
  );

  session.leadId = lead.id;
  await saveSession(session);
  await dispatchToCRMs(lead);

  console.log(
    `[maggie:voice] call ${session.callSid} finished — ${session.turns} turn(s), ` +
      `lead ${lead.id} (${lead.priority}) for ${lead.contact.name} at ${lead.contact.address || "no address given"}`,
  );
}
