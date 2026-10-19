#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Simulate a phone call against the voice webhooks — no Twilio, no phone.
// ---------------------------------------------------------------------------
// Twilio's side of a call is just form-encoded POSTs and TwiML replies, so we
// can play Twilio locally: post what the "caller" said, read what Maggie says
// back, follow the <Gather> action, stop at <Hangup/>. That makes the whole
// conversation loop — including lead routing and the CRM payloads — testable
// from a terminal.
//
//   npm run dev                       # in one terminal
//   npm run simulate-call             # scripted storm-damage call
//   npm run simulate-call -- --live   # type the caller's lines yourself
//   npm run simulate-call -- --url https://your-app.vercel.app
//
// If TWILIO_AUTH_TOKEN is set we sign requests exactly the way Twilio does,
// which also proves the signature verification accepts real traffic.
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};

const BASE = (flag("url", process.env.SIMULATE_BASE_URL || "http://localhost:3000")).replace(/\/$/, "");
const LIVE = args.includes("--live");
const FROM = flag("from", "+15125550142");
const TO = flag("to", process.env.TWILIO_PHONE_NUMBER || "+15125550100");
const CALL_SID = `CA${crypto.randomBytes(16).toString("hex")}`;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";

const SCENARIOS = {
  // A caller with storm damage who gives a name and address — the path that
  // should produce an urgent lead with every field filled in.
  storm: [
    "Hi, yeah, we had that hail storm last night and there's water coming through my kitchen ceiling.",
    "It's Dana Whitfield.",
    "Fourteen twenty Cedar Hollow Drive, Austin.",
    "No that's everything, thanks so much.",
  ],
  // A routine estimate, no urgency flag expected.
  estimate: [
    "Hi, I'm looking to get a quote on replacing my shingle roof.",
    "Marcus Webb.",
    "Eight eleven Palmetto Court, Round Rock.",
    "That's all, thank you.",
  ],
  // Twilio heard nothing, twice: Maggie should re-prompt once, then let the
  // caller go rather than talking to an empty line.
  silence: ["", ""],
  // The caller hangs up after one sentence. The lead must still exist, routed
  // on caller ID alone, because the status callback finalizes it.
  hangup: ["My roof is leaking really badly"],
};

const SCENARIO = flag("scenario", "storm");
const SCRIPTED = SCENARIOS[SCENARIO];
if (!SCRIPTED) {
  console.error(`Unknown scenario "${SCENARIO}". Try: ${Object.keys(SCENARIOS).join(", ")}`);
  process.exit(1);
}

function sign(url, params) {
  if (!AUTH_TOKEN) return null;
  const payload =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  return crypto.createHmac("sha1", AUTH_TOKEN).update(Buffer.from(payload, "utf-8")).digest("base64");
}

async function post(url, params) {
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  const signature = sign(url, params);
  if (signature) headers["X-Twilio-Signature"] = signature;

  const res = await fetch(url, { method: "POST", headers, body: new URLSearchParams(params).toString() });
  const body = await res.text();
  if (!res.ok && res.status !== 204) {
    throw new Error(`${res.status} ${res.statusText} from ${url}\n${body}`);
  }
  return body;
}

/** Pull the spoken lines, the next action URL, and the hangup flag out of TwiML. */
function parseTwiml(xml) {
  const speech = [...xml.matchAll(/<Say[^>]*>([\s\S]*?)<\/Say>/g)]
    .map((m) =>
      m[1]
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .trim(),
    )
    .join(" ");
  const action = xml.match(/<Gather[^>]*\saction="([^"]+)"/)?.[1];
  return { speech, action, hangup: xml.includes("<Hangup/>") };
}

const maggie = (text) => console.log(`\n\x1b[36mMaggie:\x1b[0m ${text}`);
const caller = (text) =>
  console.log(`\x1b[33mCaller:\x1b[0m ${text || "\x1b[2m(silence — Twilio heard nothing)\x1b[0m"}`);

async function main() {
  console.log(`\n  Calling ${BASE}/api/voice as ${FROM}${LIVE ? "" : ` (scenario: ${SCENARIO})`}`);
  console.log(`  CallSid ${CALL_SID}`);
  console.log(`  Signature: ${AUTH_TOKEN ? "signed (verification will be enforced)" : "unsigned (TWILIO_AUTH_TOKEN not set)"}`);
  console.log("  " + "-".repeat(66));

  const common = { CallSid: CALL_SID, From: FROM, To: TO, AccountSid: "ACsimulated", Direction: "inbound" };

  let twiml = await post(`${BASE}/api/voice`, { ...common, CallStatus: "ringing" });
  let parsed = parseTwiml(twiml);
  maggie(parsed.speech);

  const rl = LIVE ? readline.createInterface({ input: stdin, output: stdout }) : null;
  let turn = 0;

  while (parsed.action && !parsed.hangup) {
    let said;
    if (LIVE) {
      said = (await rl.question("\n\x1b[33mYou:\x1b[0m ")).trim();
      if (said.toLowerCase() === "/quit") break;
    } else {
      if (turn >= SCRIPTED.length) break;
      said = SCRIPTED[turn];
      caller(said);
    }
    turn++;

    twiml = await post(parsed.action, {
      ...common,
      CallStatus: "in-progress",
      SpeechResult: said,
      Confidence: "0.93",
    });
    parsed = parseTwiml(twiml);
    maggie(parsed.speech);
  }

  rl?.close();

  // However the loop ended, tell the app the call is over — the same callback
  // Twilio fires when a caller hangs up mid-sentence.
  await post(`${BASE}/api/voice/status`, {
    ...common,
    CallStatus: "completed",
    CallDuration: String(30 + turn * 12),
  });

  console.log("\n  " + "-".repeat(66));
  console.log(`  Call ended after ${turn} caller turn(s). Check the dev-server log for`);
  console.log("  the [CRM:*] payloads and the [maggie:voice] lead summary.\n");
}

main().catch((err) => {
  console.error(`\n  Simulation failed: ${err.message}\n`);
  process.exit(1);
});
