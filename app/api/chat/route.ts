import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { normalizeLead, dispatchToCRMs, missingFields } from "@/lib/crm";
import { recordClaudeSuccess, recordClaudeFailure, getHealth } from "@/lib/health";
import { buildSystemPrompt, MODEL } from "@/lib/maggie";
import { site } from "@/lib/site";

// POST /api/chat
// Two jobs:
//  1) Return Maggie's next reply. With ANTHROPIC_API_KEY set she's a real
//     Claude-powered receptionist; without it she falls back to rule-based
//     demo replies so the site always works.
//  2) When a transcript qualifies a lead, push the full context to the CRMs.
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { message, transcript, contact, finalize, leadId, leadMissing } = body || {};

  // Maggie's reply (Claude when configured, rule-based otherwise).
  const reply = await generateReply(message, transcript);

  // --- Lead routing -------------------------------------------------------
  // A phone number is enough to route: an urgent storm lead should reach the
  // crew immediately, not wait for the visitor to finish spelling their name.
  // So we send on the first phone number, then push updates under the same
  // lead id as the remaining details arrive.
  const isNewLead = Boolean(finalize) && Boolean(contact?.phone);
  const isEnrichment = typeof leadId === "string" && leadId.length > 0;

  if (isNewLead || isEnrichment) {
    const resolved = await extractContact(transcript, message, contact);
    const stillMissing = ["name", "phone", "address"].filter(
      (f) => !resolved[f as keyof Contact]?.trim(),
    );

    // On an enrichment pass, only bother the CRM if we actually learned
    // something new — otherwise every subsequent chat message would fire a
    // pointless update.
    const previouslyMissing: string[] = Array.isArray(leadMissing) ? leadMissing : [];
    const learnedSomething =
      isNewLead || stillMissing.length < previouslyMissing.length;

    if (!learnedSomething) {
      return NextResponse.json({
        ok: true,
        reply,
        leadId,
        leadMissing: stillMissing,
        mode: getHealth().mode,
      });
    }

    const intent = detectIntent(String(message || "") + " " + JSON.stringify(transcript || []));
    const lead = normalizeLead(
      "maggie_chat",
      resolved,
      {
        intent,
        transcript,
        channel: "maggie_ai_receptionist",
        priority: intent === "storm" ? "urgent" : "standard",
      },
      isEnrichment ? leadId : undefined,
    );
    const deliveries = await dispatchToCRMs(lead);

    return NextResponse.json({
      ok: true,
      reply,
      leadId: lead.id,
      priority: lead.priority,
      isUpdate: lead.isUpdate,
      // The widget echoes this back so we can tell when new details land.
      leadMissing: missingFields(lead),
      deliveries,
      mode: getHealth().mode,
    });
  }

  return NextResponse.json({ ok: true, reply, mode: getHealth().mode });
}

type TranscriptItem = { role: "maggie" | "user"; text: string };

type Contact = { name?: string; email?: string; phone?: string; address?: string };

// ---------------------------------------------------------------------------
// Contact extraction
// ---------------------------------------------------------------------------
// Visitors volunteer details however they like ("yes Jenee and my number is
// 509...", "it's Dana, 1420 Cedar Hollow"). Regexes only catch the polite
// phrasings, so names were being dropped and leads filed as "Unknown". Claude
// already has the transcript — let it do the reading. Runs once per lead, at
// finalization, not on every message.
const CONTACT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "The visitor's full name. Empty string if they never gave one." },
    phone: { type: "string", description: "The visitor's phone number, digits as they wrote them. Empty string if none." },
    email: { type: "string", description: "The visitor's email address. Empty string if none." },
    address: { type: "string", description: "The property address. Empty string if none." },
  },
  required: ["name", "phone", "email", "address"],
  additionalProperties: false,
} as const;

async function extractContact(
  transcript: TranscriptItem[] | undefined,
  latest: unknown,
  hint: Contact | undefined,
): Promise<Contact> {
  const fallback: Contact = hint || {};
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;

  const lines = [
    ...(Array.isArray(transcript) ? transcript : []),
    { role: "user" as const, text: String(latest || "") },
  ]
    .map((m) => `${m.role === "maggie" ? "Maggie" : "Visitor"}: ${m.text}`)
    .join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      thinking: { type: "disabled" },
      system:
        "You extract contact details from a roofing company's chat transcript. " +
        "Report ONLY what the visitor actually provided. If a detail was never " +
        "given, return an empty string for it. Never guess, infer, or invent a " +
        "value — a wrong phone number or address is worse than a blank one.",
      output_config: { format: { type: "json_schema", schema: CONTACT_SCHEMA } },
      messages: [{ role: "user", content: `Transcript:\n${lines}` }],
    });

    const text = res.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    )?.text;
    if (!text) return fallback;
    const parsed = JSON.parse(text) as Contact;

    // Trust the extraction, but never let it blank out something the widget
    // already captured.
    return {
      name: parsed.name?.trim() || fallback.name || "",
      phone: parsed.phone?.trim() || fallback.phone || "",
      email: parsed.email?.trim() || fallback.email || "",
      address: parsed.address?.trim() || fallback.address || "",
    };
  } catch (err) {
    console.error("[maggie] contact extraction failed, using widget capture:", err);
    return fallback;
  }
}

// Generate Maggie's next line. Uses Claude when a key is configured; on any
// failure (or no key) it falls back to the rule-based replies below so the
// widget never breaks in a live demo.
async function generateReply(message: unknown, transcript?: TranscriptItem[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback = () => replyFor(detectIntent(String(message || "")), false);

  if (!apiKey) return fallback();

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: "disabled" }, // snappy replies for a live chat widget
      system: buildSystemPrompt(),
      messages: toClaudeMessages(transcript, message),
    });
    const textBlock = res.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    const text = textBlock?.text?.trim();
    if (!text) {
      // Claude answered, but with nothing usable. Still a failure to serve.
      recordClaudeFailure(new Error("Claude returned an empty response"));
      return fallback();
    }
    recordClaudeSuccess();
    return text;
  } catch (err) {
    // The fallback keeps the widget alive, but this must NOT be silent —
    // an expired key or empty balance looks identical to a healthy site.
    recordClaudeFailure(err);
    console.error("[maggie] stack trace:", err);
    return fallback();
  }
}

// Convert the widget transcript into Claude's message format. Claude requires
// the first message to come from the user, so drop any leading assistant turns
// (the widget seeds the conversation with Maggie's greeting).
function toClaudeMessages(
  transcript: TranscriptItem[] | undefined,
  latest: unknown,
): Anthropic.MessageParam[] {
  const items =
    Array.isArray(transcript) && transcript.length
      ? transcript
      : [{ role: "user" as const, text: String(latest || "") }];

  const mapped: Anthropic.MessageParam[] = items.map((m) => ({
    role: m.role === "maggie" ? ("assistant" as const) : ("user" as const),
    content: m.text,
  }));

  while (mapped.length && mapped[0].role === "assistant") mapped.shift();
  if (!mapped.length) mapped.push({ role: "user", content: String(latest || "") });
  return mapped;
}

// ---------------------------------------------------------------------------
// Rule-based fallback (also used to tag lead urgency for the CRM)
// ---------------------------------------------------------------------------

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
      return `Hi there! I'm Maggie Mae, ${site.name}'s AI receptionist. Are you dealing with storm/leak damage, or looking for a routine roofing estimate?`;
    default:
      return "I can help with that! To point you to the right crew — is this an urgent storm/leak issue, or a routine estimate for shingles, metal, TPO, or gutters?";
  }
}
