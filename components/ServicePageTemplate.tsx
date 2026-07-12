import Link from "next/link";
import { Check, Phone, ArrowRight, Star } from "lucide-react";
import { site } from "@/lib/site";
import CTABand from "./CTABand";

export interface ServiceContent {
  title: string;
  tagline: string;
  intro: string;
  heroIcon: React.ReactNode;
  benefits: string[];
  options: { name: string; desc: string; priceHint: string }[];
  faqs: { q: string; a: string }[];
  warranty: string;
}

export default function ServicePageTemplate({ c }: { c: ServiceContent }) {
  return (
    <>
      {/* Service hero */}
      <section className="bg-brand-navy text-white">
        <div className="container-x grid gap-8 py-14 lg:grid-cols-2 lg:items-center">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-gold">
              {c.heroIcon} {c.tagline}
            </div>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">{c.title}</h1>
            <p className="mt-4 max-w-lg text-white/80">{c.intro}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href={`tel:${site.phoneRaw}`} className="btn-cta">
                <Phone size={18} /> Call {site.phoneDisplay}
              </a>
              <Link href="/#quote" className="btn-ghost">
                Instant Ballpark Quote <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="text-sm font-semibold text-brand-gold">Key benefits</div>
            <ul className="mt-4 space-y-3">
              {c.benefits.map((b) => (
                <li key={b} className="flex gap-3 text-sm">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-accent">
                    <Check size={13} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Options */}
      <section className="section">
        <div className="container-x">
          <div className="text-center">
            <div className="eyebrow">Options & Pricing Factors</div>
            <h2 className="h2 mt-2">Choose What Fits Your Home</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {c.options.map((o) => (
              <div key={o.name} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
                <h3 className="text-lg font-bold text-brand-navy">{o.name}</h3>
                <p className="mt-2 text-sm text-slate-500">{o.desc}</p>
                <div className="mt-4 inline-block rounded-lg bg-orange-50 px-3 py-1 text-sm font-bold text-brand-accentDark">
                  {o.priceHint}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-600">
            <Star size={16} className="mr-1 inline fill-brand-gold text-brand-gold" />
            Backed by our <strong>{c.warranty}</strong>.
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section bg-slate-50">
        <div className="container-x max-w-3xl">
          <div className="text-center">
            <div className="eyebrow">FAQ</div>
            <h2 className="h2 mt-2">Common Questions</h2>
          </div>
          <div className="mt-8 space-y-3">
            {c.faqs.map((f) => (
              <details key={f.q} className="group rounded-xl bg-white p-5 shadow-sm">
                <summary className="cursor-pointer list-none font-semibold text-brand-navy">
                  {f.q}
                </summary>
                <p className="mt-2 text-sm text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <CTABand />
    </>
  );
}
