// ---------------------------------------------------------------------------
// CRM / Webhook routing utilities (mock)
// ---------------------------------------------------------------------------
// In production these would POST to JobNimbus / AccuLynx / Zapier webhooks.
// Here we structure the payload exactly the way those CRMs expect and log the
// "outbound" call so the demo is transparent about what would be sent.
// ---------------------------------------------------------------------------

export type LeadSource = "quote_widget" | "estimate_form" | "maggie_chat";

export interface NormalizedLead {
  id: string;
  source: LeadSource;
  createdAt: string;
  // True when this is a revision of a lead already sent — the visitor gave us
  // more detail after we'd routed them. CRMs should upsert on `id`, not create.
  isUpdate: boolean;
  contact: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  // Free-form context: quote inputs, chat transcript, urgency flags, etc.
  context: Record<string, unknown>;
  // Derived routing hint used to prioritize storm/urgent leads.
  priority: "urgent" | "standard";
}

/** Details we still want but haven't been given yet. */
export function missingFields(lead: NormalizedLead): string[] {
  const missing: string[] = [];
  if (lead.contact.name === "Unknown") missing.push("name");
  if (!lead.contact.phone) missing.push("phone");
  if (!lead.contact.address) missing.push("address");
  return missing;
}

/**
 * Shape a raw inbound lead into a normalized record.
 *
 * Pass `existingId` to revise a lead we already sent. Storm leads are routed
 * the instant we have a phone number — waiting for a full name would delay an
 * emergency dispatch — so the name and address often arrive a turn or two
 * later. Re-normalizing under the same id lets us push those to the CRM as an
 * update instead of stranding the lead as "Unknown" forever.
 */
export function normalizeLead(
  source: LeadSource,
  contact: { name?: string; email?: string; phone?: string; address?: string },
  context: Record<string, unknown> = {},
  existingId?: string
): NormalizedLead {
  const isUrgent =
    String(context.intent || "").toLowerCase().includes("storm") ||
    String(context.intent || "").toLowerCase().includes("urgent") ||
    context.priority === "urgent";

  return {
    id: existingId || `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    source,
    createdAt: new Date().toISOString(),
    isUpdate: Boolean(existingId),
    contact: {
      name: contact.name?.trim() || "Unknown",
      email: contact.email?.trim() || "",
      phone: contact.phone?.trim() || "",
      address: contact.address?.trim() || "",
    },
    context,
    priority: isUrgent ? "urgent" : "standard",
  };
}

// ---- CRM-specific payload adapters --------------------------------------

/** JobNimbus "Contact + Job" create/update payload. */
export function toJobNimbusPayload(lead: NormalizedLead) {
  const bilingual = lead.context.needs_bilingual_followup === true;
  const tags: string[] = [lead.source, lead.priority];
  if (bilingual) tags.push("bilingual-followup");
  return {
    external_id: lead.id, // upsert key — keeps revisions off the duplicate pile
    record_type_name: "Lead",
    display_name: lead.contact.name,
    email: lead.contact.email,
    home_phone: lead.contact.phone,
    address_line1: lead.contact.address,
    status_name: lead.priority === "urgent" ? "Storm - Hot" : "New Lead",
    source_name: "Website",
    description: JSON.stringify(lead.context),
    tags,
  };
}

/** AccuLynx "Lead" create/update payload. */
export function toAccuLynxPayload(lead: NormalizedLead) {
  const bilingual = lead.context.needs_bilingual_followup === true;
  const notes = JSON.stringify(lead.context, null, 2);
  return {
    externalId: lead.id, // upsert key
    firstName: lead.contact.name.split(" ")[0],
    lastName: lead.contact.name.split(" ").slice(1).join(" ") || "-",
    email: lead.contact.email,
    cellPhone: lead.contact.phone,
    address: lead.contact.address,
    leadSource: "Web Form",
    milestone: lead.priority === "urgent" ? "Inspection - Urgent" : "New Lead",
    notes: bilingual ? `[BILINGUAL FOLLOWUP - ES]\n${notes}` : notes,
  };
}

// ---- Mock webhook dispatch ----------------------------------------------

const WEBHOOK_ENDPOINTS = {
  jobnimbus: process.env.JOBNIMBUS_WEBHOOK_URL || "",
  acculynx: process.env.ACCULYNX_WEBHOOK_URL || "",
  zapier: process.env.ZAPIER_WEBHOOK_URL || "",
};

/**
 * Fan the lead out to every configured CRM webhook. When no real endpoint is
 * configured (the demo default) we simulate an instant 200 OK and log the
 * structured payloads so you can see exactly what would be delivered.
 */
export async function dispatchToCRMs(lead: NormalizedLead) {
  const deliveries = [
    { crm: "jobnimbus", url: WEBHOOK_ENDPOINTS.jobnimbus, payload: toJobNimbusPayload(lead) },
    { crm: "acculynx", url: WEBHOOK_ENDPOINTS.acculynx, payload: toAccuLynxPayload(lead) },
    { crm: "zapier", url: WEBHOOK_ENDPOINTS.zapier, payload: lead },
  ];

  const results = await Promise.all(
    deliveries.map(async ({ crm, url, payload }) => {
      if (!url) {
        // Demo mode: no live endpoint — structure + log instead of POST.
        const verb = lead.isUpdate ? "would UPDATE" : "would deliver";
        console.log(`[CRM:${crm}] (mock) ${verb} ->`, JSON.stringify(payload));
        return { crm, delivered: true, mode: "mock" as const };
      }
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        return { crm, delivered: res.ok, mode: "live" as const, status: res.status };
      } catch (err) {
        console.error(`[CRM:${crm}] delivery failed`, err);
        return { crm, delivered: false, mode: "live" as const };
      }
    })
  );

  return results;
}
