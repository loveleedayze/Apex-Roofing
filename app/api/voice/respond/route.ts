import {
  readTwilioParams,
  verifyTwilioSignature,
  sayAndGather,
  sayAndHangup,
  generateVoiceReply,
  ensureLeadRouted,
  finalizeCall,
  shouldEndForLength,
  shouldEndForSilence,
  greeting,
  voiceUrl,
  REPROMPT,
} from "@/lib/voice";
import { getSession, saveSession, newSession } from "@/lib/callStore";
import { spokenDigits } from "@/lib/maggie";
import { site } from "@/lib/site";

// POST /api/voice/respond
//
// One request per caller utterance. Twilio sends what it heard in
// `SpeechResult`; we append it to the transcript, ask Claude for the next
// line, and hand back TwiML that speaks it and listens again. The loop ends
// when Maggie says goodbye, the caller goes quiet, or we hit the turn cap.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const params = await readTwilioParams(req);

  if (!verifyTwilioSignature(req, params)) {
    return new Response("Forbidden", { status: 403 });
  }

  const callSid = params.CallSid || "";
  const heard = (params.SpeechResult || "").trim();
  const confidence = Number(params.Confidence || "0");
  const action = voiceUrl(req, "/api/voice/respond");

  // The session should exist — /api/voice created it. If it doesn't, the store
  // lost it (a cold serverless instance with no shared store configured). Don't
  // drop the caller: rebuild an empty session and carry on. She'll repeat her
  // greeting, which is a far smaller failure than a dead line.
  let session = await getSession(callSid);
  if (!session) {
    console.warn(
      `[maggie:voice] no stored session for ${callSid} — rebuilding. If this ` +
        `recurs, configure UPSTASH_REDIS_REST_URL/TOKEN so sessions survive ` +
        `across serverless instances.`,
    );
    session = newSession(callSid, params.From || "", params.To || "");
    session.transcript.push({ role: "maggie", text: greeting() });
  }

  // --- Silence -------------------------------------------------------------
  // An empty SpeechResult means the gather timed out with nothing said: the
  // caller is thinking, on mute, or already gone. Re-prompt once, then let
  // them go rather than talking at an empty room.
  if (!heard) {
    session.emptyTurns += 1;

    if (shouldEndForSilence(session)) {
      await saveSession(session);
      await finalizeCall(session);
      // spokenDigits, not phoneDisplay: a synthesizer reads "(555) 123-ROOF"
      // as the word "roof", which is useless to someone writing it down.
      return sayAndHangup(
        `I can't hear you, so I'll let you go. Call us back any time at ${spokenDigits(site.phoneRaw)}. Goodbye.`,
      );
    }

    session.transcript.push({ role: "maggie", text: REPROMPT });
    await saveSession(session);
    return sayAndGather(REPROMPT, action);
  }

  // --- A real utterance ----------------------------------------------------
  session.emptyTurns = 0;
  session.turns += 1;
  session.transcript.push({ role: "user", text: heard });

  console.log(
    `[maggie:voice] ${callSid} turn ${session.turns} heard (conf ${confidence.toFixed(2)}): ${heard}`,
  );

  // Route the lead now, on caller ID, before we know anything else. If the
  // line drops on the next word the crew still has a number to call back.
  await ensureLeadRouted(session, heard);

  const { speech, endCall } = await generateVoiceReply(session, heard);
  session.transcript.push({ role: "maggie", text: speech });
  await saveSession(session);

  if (endCall || shouldEndForLength(session)) {
    await finalizeCall(session);
    return sayAndHangup(speech);
  }

  return sayAndGather(speech, action);
}
