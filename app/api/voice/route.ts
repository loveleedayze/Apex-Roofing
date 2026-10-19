import {
  readTwilioParams,
  verifyTwilioSignature,
  sayAndGather,
  sayAndHangup,
  greeting,
  voiceUrl,
} from "@/lib/voice";
import { newSession, saveSession } from "@/lib/callStore";

// POST /api/voice
//
// Twilio hits this the instant someone dials the number. Point your Twilio
// phone number's "A CALL COMES IN" webhook here (HTTP POST).
//
// The only job is to pick up fast and start listening. Maggie's opening line
// is a fixed string, deliberately: this is the one turn where latency is most
// obvious, and nobody wants ringing silence while an API call resolves. Every
// turn after this one is Claude.
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // HMAC signature check needs node crypto

export async function POST(req: Request) {
  const params = await readTwilioParams(req);

  if (!verifyTwilioSignature(req, params)) {
    return new Response("Forbidden", { status: 403 });
  }

  const callSid = params.CallSid || `local_${Date.now()}`;
  const from = params.From || "";
  const to = params.To || "";

  const session = newSession(callSid, from, to);
  const opening = greeting();
  session.transcript.push({ role: "maggie", text: opening });
  await saveSession(session);

  console.log(`[maggie:voice] incoming call ${callSid} from ${from || "unknown"}`);

  // Twilio can reach us but we can't hold state → better to say so than to
  // loop the caller through a conversation we'll forget.
  if (!callSid) {
    return sayAndHangup(
      "Thanks for calling. Our line is having trouble right now. Please try again in a few minutes.",
    );
  }

  return sayAndGather(opening, voiceUrl(req, "/api/voice/respond"));
}

// Twilio only ever POSTs here. A GET is a human in a browser checking whether
// they pasted the right URL into the Twilio console, so answer that question.
export async function GET() {
  return Response.json({
    service: "maggie-mae-voice",
    usage: "Set this URL as the Voice webhook (HTTP POST) on your Twilio phone number.",
    webhooks: {
      incomingCall: "POST /api/voice",
      callerSpeech: "POST /api/voice/respond",
      statusCallback: "POST /api/voice/status",
    },
  });
}
