// ---------------------------------------------------------------------------
// Demo Mode — domain model
// ---------------------------------------------------------------------------
// Everything here is pure data + pure functions: no React, no network, no DB.
// The /demo dashboard is a *sales prop*. It renders a believable CRM for a
// prospect using their own name/business pulled from the URL, then simulates
// Maggie Mae taking a live call. Nothing it produces is persisted anywhere —
// see components/demo/DemoProvider.tsx, where all of it lives in React state.
// ---------------------------------------------------------------------------

import { site } from "@/lib/site";

/** Shown wherever fabricated data could otherwise read as a real account. */
export const DEMO_DISCLOSURE =
  "Interactive demo — sample data, not a live account.";

// ---- Branding from URL params -------------------------------------------

export interface DemoBranding {
  /** e.g. "John" — the contractor we're pitching. */
  contractorName: string;
  /** e.g. "Apex Roofing" — their company. */
  businessName: string;
  city: string;
  /** 1–2 letter monogram for the sidebar logo mark. */
  monogram: string;
  /** True when the visitor supplied at least one param (vs. pure defaults). */
  personalized: boolean;
}

/**
 * Clean an untrusted URL parameter before it becomes on-screen branding.
 *
 * React escapes interpolated text, so this is about *legibility* rather than
 * script injection: strip control characters, collapse runaway whitespace, and
 * cap the length so a hostile or fat-fingered link can't blow out the layout.
 */
export function sanitizeParam(raw: string | string[] | undefined): string {
  if (typeof raw !== "string") return "";
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function toMonogram(business: string): string {
  const words = business.split(" ").filter(Boolean);
  if (words.length === 0) return "AR";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Resolve dashboard branding from the query string, e.g.
 * `/demo?contractor_name=John&business_name=Apex%20Roofing&city=Austin,%20TX`
 *
 * Every field falls back to the house account, so a bare `/demo` still renders
 * a complete, sensible dashboard.
 */
export function resolveBranding(
  searchParams: Record<string, string | string[] | undefined> = {}
): DemoBranding {
  const contractorName = sanitizeParam(searchParams.contractor_name);
  const businessName = sanitizeParam(searchParams.business_name);
  const city = sanitizeParam(searchParams.city);

  const resolvedBusiness = businessName || site.name;

  return {
    contractorName: contractorName || "there",
    businessName: resolvedBusiness,
    city: city || site.city,
    monogram: toMonogram(resolvedBusiness),
    personalized: Boolean(contractorName || businessName || city),
  };
}

// ---- Pipeline model ------------------------------------------------------

export type LeadStage =
  | "new"
  | "contacted"
  | "inspection"
  | "estimate"
  | "won";

export const STAGES: { id: LeadStage; label: string }[] = [
  { id: "new", label: "New Leads" },
  { id: "contacted", label: "Contacted" },
  { id: "inspection", label: "Inspection Booked" },
  { id: "estimate", label: "Estimate Sent" },
  { id: "won", label: "Won" },
];

export interface DemoLead {
  id: string;
  name: string;
  phone: string;
  address: string;
  service: string;
  value: number;
  stage: LeadStage;
  priority: "urgent" | "standard";
  /** Pre-baked relative label — avoids SSR/client clock mismatch on seeds. */
  receivedLabel: string;
  /** Attribution badge; simulated rows are always marked. */
  capturedBy: "Maggie Mae" | "Web Form" | "Phone";
  notes?: string;
  /** True for rows produced by the on-screen simulation. Never hidden. */
  simulated?: boolean;
}

/**
 * A believable starting pipeline. Addresses stay generic so they read fine
 * against whatever city the prospect's link specifies.
 */
export function seedLeads(): DemoLead[] {
  return [
    {
      id: "seed_1",
      name: "Marcus Whitfield",
      phone: "(512) 555-0148",
      address: "4417 Ridgeline Dr",
      service: "Storm Damage — Hail",
      value: 18400,
      stage: "new",
      priority: "urgent",
      receivedLabel: "12m ago",
      capturedBy: "Maggie Mae",
      notes: "Hail from Tuesday's storm. Insurance claim already filed.",
    },
    {
      id: "seed_2",
      name: "Priya Raghunathan",
      phone: "(512) 555-0193",
      address: "982 Cedar Hollow Ln",
      service: "Asphalt Shingles",
      value: 12250,
      stage: "new",
      receivedLabel: "48m ago",
      priority: "standard",
      capturedBy: "Web Form",
    },
    {
      id: "seed_3",
      name: "Danny Okonkwo",
      phone: "(512) 555-0117",
      address: "231 Palo Verde Ct",
      service: "Seamless Gutters",
      value: 3800,
      stage: "contacted",
      priority: "standard",
      receivedLabel: "3h ago",
      capturedBy: "Maggie Mae",
    },
    {
      id: "seed_4",
      name: "Eleanor Vance",
      phone: "(512) 555-0166",
      address: "77 Windermere Pass",
      service: "Metal Roofing",
      value: 41900,
      stage: "inspection",
      priority: "standard",
      receivedLabel: "Yesterday",
      capturedBy: "Maggie Mae",
      notes: "Standing seam quote. Wants Thursday AM.",
    },
    {
      id: "seed_5",
      name: "Sunrise Property Group",
      phone: "(512) 555-0102",
      address: "1800 Commerce Blvd",
      service: "Flat TPO Commercial",
      value: 128000,
      stage: "estimate",
      priority: "standard",
      receivedLabel: "2d ago",
      capturedBy: "Phone",
    },
    {
      id: "seed_6",
      name: "Grace Lindqvist",
      phone: "(512) 555-0175",
      address: "605 Juniper Bend",
      service: "Asphalt Shingles",
      value: 15600,
      stage: "won",
      priority: "standard",
      receivedLabel: "4d ago",
      capturedBy: "Maggie Mae",
    },
  ];
}

// ---- The simulated call --------------------------------------------------

export interface TranscriptLine {
  speaker: "maggie" | "homeowner";
  text: string;
  /** Pause *before* this line lands, ms — tuned to feel like real speech. */
  delayMs: number;
}

/**
 * The scripted inbound call. Written to demonstrate the behaviors defined in
 * lib/maggie.ts: qualify urgency, then capture name, phone, and address.
 */
export const CALL_SCRIPT: TranscriptLine[] = [
  {
    speaker: "maggie",
    text: "Thanks for calling! This is Maggie Mae — how can I help you today?",
    delayMs: 900,
  },
  {
    speaker: "homeowner",
    text: "Hi, yeah — I think I've got some damage up on my roof after that storm.",
    delayMs: 2200,
  },
  {
    speaker: "maggie",
    text: "Oh no — I'm sorry to hear that. Are you seeing any active leaking inside the house right now?",
    delayMs: 1900,
  },
  {
    speaker: "homeowner",
    text: "Not inside, no. But there are shingles all over the driveway.",
    delayMs: 2400,
  },
  {
    speaker: "maggie",
    text: "Got it — that's worth getting eyes on quickly. I can book you a free inspection. Can I grab your name?",
    delayMs: 2000,
  },
  {
    speaker: "homeowner",
    text: "Sure, it's Denise Alvarado.",
    delayMs: 1700,
  },
  {
    speaker: "maggie",
    text: "Thanks, Denise. What's the best phone number and the property address?",
    delayMs: 1600,
  },
  {
    speaker: "homeowner",
    text: "512-555-0129, and it's 3390 Harper Oaks Drive.",
    delayMs: 2600,
  },
  {
    speaker: "maggie",
    text: "Perfect — you're booked for a free storm inspection, and the team will call you today to lock in a time. We'll also walk you through the insurance claim if you need it.",
    delayMs: 2100,
  },
  {
    speaker: "homeowner",
    text: "That's great, thank you so much!",
    delayMs: 1800,
  },
];

export interface CallSummary {
  headline: string;
  actionItems: string[];
}

export const CALL_SUMMARY: CallSummary = {
  headline:
    "Storm damage inspection booked — shingle loss after recent storm, no active interior leak.",
  actionItems: [
    "Call Denise today to confirm inspection window",
    "Flag as storm/insurance claim — assign adjuster-experienced crew",
    "Bring drone for ridge and driveway-side slope",
  ],
};

/**
 * Build the lead row the simulated call produces. Marked `simulated` so it is
 * always visually distinguishable from real pipeline data.
 */
export function buildSimulatedLead(): DemoLead {
  return {
    id: `sim_${Date.now()}`,
    name: "Denise Alvarado",
    phone: "(512) 555-0129",
    address: "3390 Harper Oaks Dr",
    service: "Storm Damage — Shingle Loss",
    value: 16750,
    stage: "new",
    priority: "urgent",
    receivedLabel: "Just now",
    capturedBy: "Maggie Mae",
    notes: CALL_SUMMARY.headline,
    simulated: true,
  };
}

/** Formats cents-free currency for pipeline tiles. */
export function formatValue(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}
