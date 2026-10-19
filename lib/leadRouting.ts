// ---------------------------------------------------------------------------
// Lead routing — one path for every channel
// ---------------------------------------------------------------------------
// Chat widget and browser call widget both end here. That is the point: a
// storm lead should be read, qualified, tagged and delivered identically
// whether the homeowner typed it or said it, in English or in Spanish. When
// this logic lived in the chat route only, the voice side quietly grew its own
// slightly different version — this file exists so that can't happen again.
//
// The rule the whole thing is built around: route on what we have, upsert as
// we learn more. Waiting for a complete record before telling the crew about
// an active leak is how a lead becomes a missed job.
// ---------------------------------------------------------------------------

import { normalizeLead, dispatchToCRMs, missingFields } from "@/lib/crm";
import type { LeadSource, NormalizedLead } from "@/lib/crm";
import { detectIntent, extractContact } from "@/lib/maggie";
import type { Contact, TranscriptItem } from "@/lib/maggie";

/** The details a lead is expected to carry before we stop chasing them. */
const WANTED: Array<keyof Contact> = ["name", "phone", "address"];

export interface LeadTurnInput {
  source: LeadSource;
  /** Everything said so far, in whatever language it was said in. */
  transcript?: TranscriptItem[];
  /** The newest message, if it isn't in the transcript yet. */
  latest?: unknown;
  /** What the client already knows — widget fields, caller ID. */
  contact?: Contact;
  /** Set once routed, so later turns upsert instead of creating duplicates. */
  leadId?: string;
  /** What was missing last time we routed, to spot when we've learned something. */
  leadMissing?: string[];
  /** "english" | "spanish" — recorded so the callback gets the right person. */
  language?: string;
  /** Goes into the CRM record's context blob. */
  channel: string;
  /** True when this is the last chance to read the conversation. */
  finalize?: boolean;
  /** Anything channel-specific: call duration, turn count, transcript, etc. */
  extra?: Record<string, unknown>;
}

export interface LeadTurnResult {
  /** False when nothing new was learned and we deliberately didn't re-send. */
  routed: boolean;
  leadId?: string;
  leadMissing: string[];
  priority?: NormalizedLead["priority"];
  isUpdate?: boolean;
  deliveries?: Awaited<ReturnType<typeof dispatchToCRMs>>;
  /** What we now believe about the person, after reading the transcript. */
  contact: Contact;
}

/**
 * Read the conversation, then create or update the lead.
 *
 * Skips the CRM round trip when an enrichment pass learned nothing new —
 * otherwise every subsequent message would fire a pointless update — but
 * always sends on the first route and on finalization.
 */
export async function routeLeadTurn(input: LeadTurnInput): Promise<LeadTurnResult> {
  const {
    source,
    transcript,
    latest,
    contact,
    leadId,
    leadMissing,
    language,
    channel,
    finalize,
    extra,
  } = input;

  const isEnrichment = typeof leadId === "string" && leadId.length > 0;

  // The language is passed in from the live conversation rather than inferred
  // here: the channel watched the switch happen turn by turn, this pass only
  // sees text after the fact.
  const resolved = await extractContact(transcript, latest, { ...contact, language });
  const stillMissing = WANTED.filter((f) => !resolved[f]?.trim());

  const previouslyMissing: string[] = Array.isArray(leadMissing) ? leadMissing : [];
  const learnedSomething =
    !isEnrichment || finalize || stillMissing.length < previouslyMissing.length;

  if (!learnedSomething) {
    return { routed: false, leadId, leadMissing: stillMissing, contact: resolved };
  }

  const spoken =
    String(latest || "") + " " + (Array.isArray(transcript) ? transcript.map((t) => t.text).join(" ") : "");
  const intent = detectIntent(spoken);

  const lead = normalizeLead(
    source,
    resolved,
    {
      intent,
      channel,
      priority: intent === "storm" ? "urgent" : "standard",
      language: resolved.language || language || "english",
      transcript,
      ...extra,
    },
    isEnrichment ? leadId : undefined,
  );

  const deliveries = await dispatchToCRMs(lead);

  return {
    routed: true,
    leadId: lead.id,
    leadMissing: missingFields(lead),
    priority: lead.priority,
    isUpdate: lead.isUpdate,
    deliveries,
    contact: resolved,
  };
}
