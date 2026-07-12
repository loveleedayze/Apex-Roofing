import { NextResponse } from "next/server";
import { normalizeLead, dispatchToCRMs, type LeadSource } from "@/lib/crm";

// POST /api/lead
// Captures both the gated quote-widget lead and the "Request Free Estimate"
// form, normalizes it, and fans it out to the configured CRM webhooks.
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, phone, source, context } = body || {};

  // Minimal server-side validation — the gate must not be bypassable.
  if (!name || !email || !phone) {
    return NextResponse.json(
      { ok: false, error: "Name, email, and phone are required." },
      { status: 422 }
    );
  }

  const lead = normalizeLead(
    (source as LeadSource) || "quote_widget",
    { name, email, phone },
    context || {}
  );

  const deliveries = await dispatchToCRMs(lead);

  return NextResponse.json({
    ok: true,
    leadId: lead.id,
    priority: lead.priority,
    deliveries,
  });
}
