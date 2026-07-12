import Link from "next/link";
import { Phone, Star, Clock, ShieldCheck, ArrowRight } from "lucide-react";
import { site } from "@/lib/site";

/**
 * Sticky-feel conversion hero. Everything critical sits above the fold:
 * headline, trust row, and BOTH CTAs (urgent call + free estimate).
 */
export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-brand-navy text-white">
      {/* Decorative SVG skyline/roof pattern — cheap, no image request */}
      <BackgroundPattern />

      <div className="container-x relative grid gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:items-center">
        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
            <Star size={14} className="fill-brand-gold text-brand-gold" />
            {site.googleRating.toFixed(1)} rated • {site.googleReviewCount}+ reviews • {site.yearsInBusiness} yrs
          </div>

          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            A Roof That Protects.
            <span className="block text-brand-gold">Service That Responds.</span>
          </h1>

          <p className="mt-4 max-w-lg text-white/80">
            Storm damage or a routine upgrade — Apex Roofing delivers premium
            asphalt, metal, and flat TPO systems with same-day inspections and a
            lifetime workmanship warranty.
          </p>

          {/* Dual CTA — urgent tel: + routine estimate */}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href={`tel:${site.phoneRaw}`} className="btn-cta text-base">
              <Phone size={18} /> Call Now — {site.phoneDisplay}
            </a>
            <Link href="#quote" className="btn-ghost text-base">
              Get Free Estimate <ArrowRight size={18} />
            </Link>
          </div>

          {/* Trust chips */}
          <div className="mt-8 grid grid-cols-3 gap-3 text-center text-xs">
            <Chip icon={<Clock size={16} />} label="24/7 Storm Response" />
            <Chip icon={<ShieldCheck size={16} />} label="Licensed & Insured" />
            <Chip icon={<Star size={16} />} label="Lifetime Warranty" />
          </div>
        </div>

        {/* Right: the gated quote widget lives on the homepage; here we show a
            visual hero card that also anchors the eye toward conversion. */}
        <div className="animate-fade-up rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur">
          <div className="text-sm font-semibold text-brand-gold">Why homeowners pick Apex</div>
          <ul className="mt-4 space-y-4">
            {[
              ["Same-day inspections", "Report + photos within hours, not days."],
              ["Insurance specialists", "We handle the claim paperwork for you."],
              ["No money down", "You pay nothing until the job is done right."],
              ["Instant online quote", "Ballpark your project in under a minute."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-accent text-xs font-bold">
                  ✓
                </span>
                <div>
                  <div className="font-semibold">{t}</div>
                  <div className="text-sm text-white/70">{d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-white/5 py-3 text-white/80">
      <span className="text-brand-gold">{icon}</span>
      {label}
    </div>
  );
}

function BackgroundPattern() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]"
      aria-hidden="true"
    >
      <defs>
        <pattern id="roofgrid" width="40" height="20" patternUnits="userSpaceOnUse">
          <path d="M0 20 L20 0 L40 20" fill="none" stroke="#fff" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#roofgrid)" />
    </svg>
  );
}
