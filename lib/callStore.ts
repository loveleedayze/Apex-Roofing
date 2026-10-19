// ---------------------------------------------------------------------------
// Call session store
// ---------------------------------------------------------------------------
// A phone call is not one request — it's a dozen. Twilio POSTs to us once per
// caller utterance, and each POST is a separate serverless invocation. The
// transcript has to survive between them or Maggie restarts the conversation
// every time the caller finishes a sentence.
//
// In-memory Map works locally and usually works on a warm Vercel lambda, but
// "usually" is not good enough for a live phone line: two concurrent calls, or
// one cold start mid-call, and the transcript is gone. So the store is
// pluggable — set UPSTASH_REDIS_REST_URL/TOKEN (or Vercel KV's
// KV_REST_API_URL/TOKEN) and sessions move to Redis over plain fetch, no SDK.
//
// Without those vars we fall back to memory and say so at /api/health, rather
// than pretending the line is production-ready.
// ---------------------------------------------------------------------------

import type { Contact } from "@/lib/maggie";

export type VoiceTurn = { role: "maggie" | "user"; text: string };

export interface CallSession {
  callSid: string;
  /** Caller ID from Twilio — a phone number we have before they say a word. */
  from: string;
  to: string;
  startedAt: string;
  transcript: VoiceTurn[];
  /** Set once the lead has been pushed to the CRMs, so later turns upsert. */
  leadId?: string;
  /** Details recovered from the transcript at the end of the call. */
  contact: Contact;
  /** Caller utterances handled so far — a runaway-loop guard. */
  turns: number;
  /** Consecutive gathers that heard nothing — silence/hangup detection. */
  emptyTurns: number;
  /** True once the lead has been finalized; keeps hangup + status idempotent. */
  finalized?: boolean;
}

const TTL_SECONDS = 60 * 60; // far longer than any roofing call
const KEY_PREFIX = "maggie:call:";

const redisUrl = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "").replace(/\/$/, "");
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

/** "redis" when a shared store is configured, "memory" otherwise. */
export const storeMode: "redis" | "memory" = redisUrl && redisToken ? "redis" : "memory";

// Module-level fallback. Survives across requests on one warm instance only.
const memory = new Map<string, { json: string; expiresAt: number }>();

function memGet(key: string): CallSession | null {
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  return JSON.parse(hit.json) as CallSession;
}

async function redis(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${redisUrl}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${redisToken}`, ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis ${res.status} on ${path.split("/")[0]}`);
  return res.json();
}

export async function getSession(callSid: string): Promise<CallSession | null> {
  const key = KEY_PREFIX + callSid;
  if (storeMode === "redis") {
    try {
      const out = await redis(`get/${encodeURIComponent(key)}`);
      return out?.result ? (JSON.parse(out.result) as CallSession) : null;
    } catch (err) {
      // A dropped transcript is recoverable (Maggie re-greets); a 500 mid-call
      // is not. Degrade to memory rather than dropping the call.
      console.error("[maggie:voice] session read failed, falling back to memory:", err);
    }
  }
  return memGet(key);
}

export async function saveSession(session: CallSession): Promise<void> {
  const key = KEY_PREFIX + session.callSid;
  const json = JSON.stringify(session);
  memory.set(key, { json, expiresAt: Date.now() + TTL_SECONDS * 1000 });
  if (storeMode === "redis") {
    try {
      await redis(`set/${encodeURIComponent(key)}?EX=${TTL_SECONDS}`, { method: "POST", body: json });
    } catch (err) {
      console.error("[maggie:voice] session write failed, memory copy kept:", err);
    }
  }
}

export async function deleteSession(callSid: string): Promise<void> {
  const key = KEY_PREFIX + callSid;
  memory.delete(key);
  if (storeMode === "redis") {
    try {
      await redis(`del/${encodeURIComponent(key)}`, { method: "POST" });
    } catch (err) {
      console.error("[maggie:voice] session delete failed:", err);
    }
  }
}

/** A fresh session for a call we haven't seen (or whose state we lost). */
export function newSession(callSid: string, from: string, to: string): CallSession {
  return {
    callSid,
    from,
    to,
    startedAt: new Date().toISOString(),
    transcript: [],
    contact: { phone: from },
    turns: 0,
    emptyTurns: 0,
  };
}
