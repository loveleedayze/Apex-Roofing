import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { normalizeLead, dispatchToCRMs } from "@/lib/crm";
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

  const { message, transcript, contact, finalize } = body || {};

  // Maggie's reply (Claude when configured, rule-based otherwise).
  const reply = await generateReply(message, transcript);

  // --- Lead finalization branch ------------------------------------------
  // Called when the visitor has shared enough to route to the CRM.
  if (finalize && contact?.phone) {
    const intent = detectIntent(String(message || "") + " " + JSON.stringify(transcript || []));
    const language = detectLanguage(collectVisitorText(transcript, message));
    const needsBilingualFollowup = language === "es";

    // Only pay for the summary call when the lead actually needs bilingual
    // follow-up — for English leads the transcript already reads natively.
    const bilingualSummary = needsBilingualFollowup
      ? await summarizeForBilingualHandoff({ transcript, contact, intent })
      : null;

    const lead = normalizeLead("maggie_chat", contact, {
      intent,
      transcript,
      channel: "maggie_ai_receptionist",
      priority: intent === "storm" ? "urgent" : "standard",
      detected_language: language,
      needs_bilingual_followup: needsBilingualFollowup,
      ...(bilingualSummary ? { bilingual_summary: bilingualSummary } : {}),
    });
    const deliveries = await dispatchToCRMs(lead);
    return NextResponse.json({
      ok: true,
      leadId: lead.id,
      priority: lead.priority,
      needsBilingualFollowup,
      reply,
      deliveries,
    });
  }

  return NextResponse.json({ ok: true, reply });
}

type TranscriptItem = { role: "maggie" | "user"; text: string };

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
    return textBlock?.text?.trim() || fallback();
  } catch (err) {
    console.error("[maggie] Claude call failed, falling back to rule-based:", err);
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

// ---------------------------------------------------------------------------
// Bilingual follow-up support
// ---------------------------------------------------------------------------
// Flag Spanish-speaking leads so the roofing company can route the callback
// to a bilingual team member. Detection is heuristic (fast, no LLM call);
// the English summary uses Claude and is skipped in demo mode without a key.

function collectVisitorText(transcript: unknown, latest: unknown): string {
  const parts: string[] = [];
  if (Array.isArray(transcript)) {
    for (const m of transcript as TranscriptItem[]) {
      if (m && m.role === "user" && typeof m.text === "string") parts.push(m.text);
    }
  }
  if (typeof latest === "string") parts.push(latest);
  return parts.join(" ");
}

// Score Spanish- vs English-marker hits across the visitor's messages.
// Small closed-class stopword list — high precision, low recall is fine here
// because we aggregate over the whole transcript.
const ES_MARKERS = /\b(hola|gracias|por favor|buenos|buenas|d[ií]a|d[ií]as|tarde|noche|necesito|necesita|quiero|puedo|puede|est[aá]|estamos|estoy|tengo|tiene|casa|techo|tejado|gotera|goteras|lluvia|granizo|tormenta|reparar|reparaci[oó]n|presupuesto|estimado|gratis|cu[aá]nto|d[oó]nde|cu[aá]ndo|c[oó]mo|s[ií]|no|el|la|los|las|un|una|de|del|para|con|mi|mis|su|sus|y|o|pero|porque|hoy|ma[ñn]ana|ayer|ahora|muy|m[aá]s)\b/gi;

const EN_MARKERS = /\b(hi|hello|hey|thanks|thank|please|good|morning|afternoon|evening|need|want|can|is|are|am|have|has|house|roof|leak|leaks|rain|hail|storm|repair|estimate|free|how|where|when|what|yes|no|the|a|an|of|for|with|my|your|and|or|but|because|today|tomorrow|yesterday|now|very|more)\b/gi;

function detectLanguage(text: string): "en" | "es" | "unknown" {
  if (!text) return "unknown";
  const es = (text.match(ES_MARKERS) || []).length;
  const en = (text.match(EN_MARKERS) || []).length;
  if (es === 0 && en === 0) return "unknown";
  if (es > en * 1.2) return "es";
  if (en > es * 1.2) return "en";
  return "unknown";
}

type BilingualSummary = {
  caller_name: string;
  phone: string;
  need: string;
  urgency: "urgent" | "standard";
};

async function summarizeForBilingualHandoff(args: {
  transcript: unknown;
  contact: { name?: string; phone?: string };
  intent: Intent;
}): Promise<BilingualSummary | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallbackNeed =
    args.intent === "storm"
      ? "Storm/leak damage — needs urgent inspection."
      : args.intent === "commercial"
      ? "Commercial flat/TPO roofing inquiry."
      : args.intent === "gutters"
      ? "Gutter installation or repair."
      : "Roofing estimate request.";
  const fallback: BilingualSummary = {
    caller_name: args.contact?.name?.trim() || "Unknown",
    phone: args.contact?.phone?.trim() || "",
    need: fallbackNeed,
    urgency: args.intent === "storm" ? "urgent" : "standard",
  };

  if (!apiKey) return fallback;

  const messagesText = Array.isArray(args.transcript)
    ? (args.transcript as TranscriptItem[])
        .map((m) => `${m.role === "maggie" ? "Maggie" : "Visitor"}: ${m.text}`)
        .join("\n")
    : "";

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      thinking: { type: "disabled" },
      system:
        "You translate and summarize a Spanish-language roofing chat into English for a bilingual team member's callback. Respond with ONLY a JSON object matching this shape: {\"caller_name\": string, \"phone\": string, \"need\": string, \"urgency\": \"urgent\" | \"standard\"}. Keep `need` to one sentence. No preamble, no code fences.",
      messages: [
        {
          role: "user",
          content: `Contact on file: name=${fallback.caller_name}, phone=${fallback.phone}.\n\nTranscript:\n${messagesText}`,
        },
      ],
    });
    const textBlock = res.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    const raw = textBlock?.text?.trim();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<BilingualSummary>;
    return {
      caller_name: parsed.caller_name?.trim() || fallback.caller_name,
      phone: parsed.phone?.trim() || fallback.phone,
      need: parsed.need?.trim() || fallback.need,
      urgency: parsed.urgency === "urgent" ? "urgent" : "standard",
    };
  } catch (err) {
    console.error("[maggie] bilingual summary failed, using fallback:", err);
    return fallback;
  }
}
