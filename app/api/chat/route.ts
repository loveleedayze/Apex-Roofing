import { NextResponse } from "next/server";
import { normalizeLead, dispatchToCRMs } from "@/lib/crm";

// POST /api/chat
// Two jobs:
//  1) Return Maggie's next reply for a given user message (rule-based demo).
//  2) When a transcript qualifies a lead, push the full context to the CRMs.
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { message, transcript, contact, finalize } = body || {};

  // --- Lead finalization branch ------------------------------------------
  // Called when the visitor has shared enough to route to the CRM.
  if (finalize && contact?.phone) {
    const intent = detectIntent(String(message || "") + " " + JSON.stringify(transcript || []));
    const lead = normalizeLead("maggie_chat", contact, {
      intent,
      transcript,
      channel: "maggie_ai_receptionist",
      priority: intent === "storm" ? "urgent" : "standard",
    });
    const deliveries = await dispatchToCRMs(lead);
    return NextResponse.json({
      ok: true,
      leadId: lead.id,
      priority: lead.priority,
      reply: replyFor(intent, true),
      deliveries,
    });
  }

  // --- Conversational branch ---------------------------------------------
  const intent = detectIntent(String(message || ""));
  return NextResponse.json({
    ok: true,
    intent,
    reply: replyFor(intent, false),
  });
}

type Intent = "storm" | "estimate" | "commercial" | "gutters" | "greeting" | "unknown";

function detectIntent(text: string): Intent {
  const t = text.toLowerCase();
  if (/(storm|hail|wind|leak|emergency|urgent|damage|missing shingle)/.test(t)) return "storm";
  if (/(tpo|flat|commercial|membrane|warehouse)/.test(t)) return "commercial";
  if (/(gutter|downspout)/.test(t)) return "gutters";
  if (/(estimate|quote|price|cost|replace|install)/.test(t)) return "estimate";
  if (/(hi|hello|hey|good (morning|afternoon))/.test(t)) return "greeting";
  return "unknown";
}

function replyFor(intent: Intent, finalized: boolean): string {
  if (finalized) {
    return intent === "storm"
      ? "Thanks! I've flagged this as URGENT storm damage and dispatched it to our on-call crew — expect a call within 15 minutes. 🚨"
      : "Perfect — I've booked you in for a free estimate and sent your details to our scheduling team. You'll hear from us shortly! 📆";
  }
  switch (intent) {
    case "storm":
      return "Oh no — that sounds like storm damage. This is time-sensitive, so let's move fast. Can I grab your name, phone number, and address to dispatch an emergency inspection today?";
    case "commercial":
      return "Got it — a flat/TPO commercial project. Our commercial team handles membrane repair and full re-roofs. What's the approximate square footage, and can I get your contact info for a site visit?";
    case "gutters":
      return "Happy to help with gutters! We install seamless aluminum gutters and leaf guards. Would you like a free measurement? I just need your name and best phone number.";
    case "estimate":
      return "Great — I can set up a free, no-pressure estimate. Is this a repair or a full replacement? And what's the best name and phone number to reach you?";
    case "greeting":
      return "Hi there! I'm Maggie Mae, Apex Roofing's AI receptionist. Are you dealing with storm/leak damage, or looking for a routine roofing estimate?";
    default:
      return "I can help with that! To point you to the right crew — is this an urgent storm/leak issue, or a routine estimate for shingles, metal, TPO, or gutters?";
  }
}
