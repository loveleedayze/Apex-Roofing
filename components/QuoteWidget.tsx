"use client";

import { useMemo, useState } from "react";
import {
  Lock,
  Satellite,
  Loader2,
  CheckCircle2,
  Home,
  ShieldCheck,
} from "lucide-react";

type Shingle = {
  key: string;
  label: string;
  // Installed cost per square foot (materials + labor), ballpark.
  low: number;
  high: number;
};

const SHINGLES: Shingle[] = [
  { key: "3tab", label: "3-Tab Asphalt", low: 4.5, high: 6.5 },
  { key: "arch", label: "Architectural Shingle", low: 6, high: 9 },
  { key: "metal", label: "Standing Seam Metal", low: 10, high: 16 },
  { key: "tpo", label: "Flat TPO Membrane", low: 7, high: 12 },
];

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function QuoteWidget() {
  // Gate state
  const [unlocked, setUnlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);

  // Calculator state (revealed after unlock)
  const [sqft, setSqft] = useState(1800);
  const [shingle, setShingle] = useState<Shingle>(SHINGLES[1]);

  const valid =
    form.name.trim().length > 1 &&
    /^\S+@\S+\.\S+$/.test(form.email) &&
    form.phone.replace(/\D/g, "").length >= 10;

  const quote = useMemo(() => {
    // Waste + complexity factor baked into the range.
    const low = Math.round((sqft * shingle.low) / 100) * 100;
    const high = Math.round((sqft * shingle.high) / 100) * 100;
    return { low, high };
  }, [sqft, shingle]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError("Please enter a valid name, email, and 10-digit phone number.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Fire the lead into the CRM pipeline before revealing the calculator.
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          source: "quote_widget",
          context: { intent: "estimate", widget: "instant_ballpark" },
        }),
      });
    } catch {
      /* Non-blocking for the demo — still unlock the UX. */
    } finally {
      setSubmitting(false);
      setUnlocked(true);
    }
  }

  return (
    <div id="quote" className="scroll-mt-28">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-100">
        <div className="grid md:grid-cols-2">
          {/* Left rail — always visible marketing/trust */}
          <div className="bg-brand-navy p-8 text-white">
            <div className="eyebrow text-brand-gold">Instant Estimate</div>
            <h3 className="mt-2 text-2xl font-extrabold">
              Instant Roof Ballpark Quote
            </h3>
            <p className="mt-3 text-sm text-white/80">
              Enter your details to unlock our satellite roof mapping tool and
              get a real-time ballpark price range — no waiting, no sales call
              required.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Powered by aerial/satellite measurement",
                "Adjust square footage & material live",
                "Ballpark range in seconds",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand-gold" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex items-center gap-2 rounded-lg bg-white/5 p-3 text-xs text-white/70">
              <ShieldCheck size={16} className="text-brand-gold" />
              We never sell your info. Used only to prepare your estimate.
            </div>
          </div>

          {/* Right panel — GATE then CALCULATOR */}
          <div className="p-8">
            {!unlocked ? (
              /* ---------------- THE GATE ---------------- */
              <form onSubmit={handleUnlock} className="flex h-full flex-col">
                <div className="mb-4 flex items-center gap-2 text-brand-navy">
                  <Lock size={18} className="text-brand-accent" />
                  <span className="text-sm font-bold">
                    Unlock your instant quote
                  </span>
                </div>

                <Field
                  label="Full Name"
                  value={form.name}
                  onChange={(v) => setForm({ ...form, name: v })}
                  placeholder="Jane Homeowner"
                  autoComplete="name"
                />
                <Field
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                  placeholder="jane@email.com"
                  autoComplete="email"
                />
                <Field
                  label="Phone Number"
                  type="tel"
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                  placeholder="(555) 123-4567"
                  autoComplete="tel"
                />

                {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-cta mt-4 w-full disabled:opacity-70"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Mapping your roof…
                    </>
                  ) : (
                    <>
                      <Satellite size={18} /> Reveal My Instant Quote
                    </>
                  )}
                </button>
                <p className="mt-3 text-center text-xs text-slate-400">
                  🔒 Calculator unlocks immediately after you submit.
                </p>
              </form>
            ) : (
              /* -------------- THE CALCULATOR -------------- */
              <div className="animate-fade-up">
                <div className="mb-4 flex items-center gap-2 text-brand-navy">
                  <Satellite size={18} className="text-brand-accent" />
                  <span className="text-sm font-bold">
                    Satellite Roof Mapping — {form.name.split(" ")[0]}&apos;s Home
                  </span>
                </div>

                {/* Simulated satellite/drone mapping visualization */}
                <RoofMap sqft={sqft} />

                {/* Square footage slider */}
                <div className="mt-5">
                  <div className="flex items-center justify-between text-sm font-semibold text-brand-navy">
                    <span className="flex items-center gap-1">
                      <Home size={15} /> Roof area
                    </span>
                    <span>{sqft.toLocaleString()} sq ft</span>
                  </div>
                  <input
                    type="range"
                    min={800}
                    max={5000}
                    step={50}
                    value={sqft}
                    onChange={(e) => setSqft(Number(e.target.value))}
                    className="mt-2 w-full"
                  />
                </div>

                {/* Material selection */}
                <div className="mt-5">
                  <div className="text-sm font-semibold text-brand-navy">Material</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {SHINGLES.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setShingle(s)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                          shingle.key === s.key
                            ? "border-brand-accent bg-orange-50 text-brand-accentDark"
                            : "border-slate-200 text-brand-slate hover:border-slate-300"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* The automated ballpark range */}
                <div className="mt-6 rounded-xl bg-brand-navy p-5 text-white">
                  <div className="text-xs uppercase tracking-wider text-white/60">
                    Estimated ballpark range
                  </div>
                  <div className="mt-1 text-3xl font-extrabold text-brand-gold">
                    {money(quote.low)} – {money(quote.high)}
                  </div>
                  <p className="mt-2 text-xs text-white/60">
                    Automated estimate only. Final pricing confirmed after a free
                    on-site inspection.
                  </p>
                </div>

                <a href="#" className="btn-cta mt-4 w-full">
                  Lock In This Price — Book Inspection
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-semibold text-brand-slate">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-orange-100"
      />
    </label>
  );
}

/** Pure-SVG "satellite" roof map — no external image, sub-3s friendly. */
function RoofMap({ sqft }: { sqft: number }) {
  // Scale the highlighted footprint slightly with sqft for realism.
  const scale = 0.7 + Math.min(sqft, 5000) / 12000;
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-[#20303b]">
      <svg viewBox="0 0 400 220" className="h-44 w-full">
        {/* ground */}
        <rect width="400" height="220" fill="#243642" />
        {/* streets */}
        <rect x="0" y="150" width="400" height="16" fill="#33485600" stroke="#3a5262" strokeWidth="8" />
        <line x1="120" y1="0" x2="120" y2="220" stroke="#3a5262" strokeWidth="8" />
        {/* neighbor rooftops */}
        <rect x="20" y="30" width="60" height="45" fill="#2f4552" />
        <rect x="300" y="40" width="70" height="55" fill="#2f4552" />
        <rect x="40" y="175" width="80" height="35" fill="#2f4552" />
        {/* target roof (highlighted) */}
        <g transform={`translate(200 100) scale(${scale})`}>
          <polygon
            points="-70,-40 70,-40 70,40 -70,40"
            fill="#f97316"
            fillOpacity="0.18"
            stroke="#f97316"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
          <line x1="-70" y1="0" x2="70" y2="0" stroke="#fbbf24" strokeWidth="1.5" />
          {/* measurement pins */}
          {[
            [-70, -40],
            [70, -40],
            [70, 40],
            [-70, 40],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="4" fill="#fbbf24" />
          ))}
        </g>
        {/* scanning line */}
        <rect x="0" y="0" width="400" height="2" fill="#fbbf24" opacity="0.5">
          <animate attributeName="y" from="0" to="220" dur="2.2s" repeatCount="indefinite" />
        </rect>
      </svg>
      <div className="absolute left-3 top-3 flex items-center gap-1 rounded bg-black/40 px-2 py-1 text-[10px] font-semibold text-brand-gold">
        <Satellite size={12} /> LIVE AERIAL SCAN
      </div>
    </div>
  );
}
