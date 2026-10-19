import { readTwilioParams, verifyTwilioSignature, finalizeCall } from "@/lib/voice";
import { getSession, deleteSession } from "@/lib/callStore";

// POST /api/voice/status
//
// Twilio's call status callback. Set it on the phone number (or on the TwiML
// app) alongside the voice webhook.
//
// This is the safety net for the call that does NOT end politely: the caller
// hangs up mid-sentence, the line drops, the carrier fails. Those calls never
// reach a <Hangup/>, so without this the transcript would sit in the store
// until it expired and the lead would keep whatever partial details it had.
// finalizeCall is idempotent, so a call that ended cleanly passes through here
// harmlessly.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TERMINAL = new Set(["completed", "busy", "failed", "no-answer", "canceled"]);

export async function POST(req: Request) {
  const params = await readTwilioParams(req);

  if (!verifyTwilioSignature(req, params)) {
    return new Response("Forbidden", { status: 403 });
  }

  const callSid = params.CallSid || "";
  const status = (params.CallStatus || "").toLowerCase();

  if (!TERMINAL.has(status)) {
    // ringing / in-progress — nothing to do yet.
    return new Response(null, { status: 204 });
  }

  const session = await getSession(callSid);
  if (session) {
    console.log(
      `[maggie:voice] call ${callSid} ended (${status}, ${params.CallDuration || "?"}s)`,
    );
    await finalizeCall(session);
    await deleteSession(callSid);
  }

  return new Response(null, { status: 204 });
}
