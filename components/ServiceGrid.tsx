import Link from "next/link";
import { Layers, Zap, Building2, Droplets, ArrowRight } from "lucide-react";
import { services } from "@/lib/site";

const ICONS: Record<string, React.ReactNode> = {
  "asphalt-shingles": <Layers size={24} />,
  "metal-roofing": <Zap size={24} />,
  "flat-tpo": <Building2 size={24} />,
  gutters: <Droplets size={24} />,
};

const BLURB: Record<string, string> = {
  "asphalt-shingles": "America's #1 roof. Durable architectural shingles in dozens of colors.",
  "metal-roofing": "Standing seam & panels that last 50+ years and shrug off any storm.",
  "flat-tpo": "Energy-efficient commercial membranes for flat & low-slope buildings.",
  gutters: "Seamless aluminum gutters & leaf guards that protect your foundation.",
};

export default function ServiceGrid() {
  return (
    <section className="section">
      <div className="container-x">
        <div className="text-center">
          <div className="eyebrow">What We Do</div>
          <h2 className="h2 mt-2">Specialized Roofing Systems</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-500">
            Dedicated crews and materials for every roof type — pick your project
            to see options, pricing factors, and warranties.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <Link
              key={s.slug}
              href={s.href}
              className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-card transition hover:-translate-y-1 hover:border-brand-accent/40"
            >
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-orange-50 text-brand-accent">
                {ICONS[s.slug]}
              </span>
              <h3 className="mt-4 text-lg font-bold text-brand-navy">{s.title}</h3>
              <p className="mt-2 flex-1 text-sm text-slate-500">{BLURB[s.slug]}</p>
              <span className="mt-4 flex items-center gap-1 text-sm font-semibold text-brand-accent">
                Learn more <ArrowRight size={15} className="transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
