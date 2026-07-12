import { Star, BadgeCheck } from "lucide-react";
import { site } from "@/lib/site";

type Review = {
  name: string;
  initial: string;
  color: string;
  when: string;
  text: string;
};

const REVIEWS: Review[] = [
  {
    name: "Marcus D.",
    initial: "M",
    color: "#2563eb",
    when: "2 days ago",
    text: "After the hailstorm Apex had an inspector out the same afternoon. Full architectural shingle replacement done in ONE day. Insurance paperwork handled start to finish. Unreal turnaround.",
  },
  {
    name: "Priya S.",
    initial: "P",
    color: "#db2777",
    when: "1 week ago",
    text: "Maggie (their chat) booked my estimate at 11pm and a real human called first thing. Crew was spotless, professional, and cleaned up every nail. Highly recommend.",
  },
  {
    name: "The Ruiz Family",
    initial: "R",
    color: "#16a34a",
    when: "3 weeks ago",
    text: "Got standing seam metal on our place. Quote was transparent, no pressure, and the finished roof looks incredible. Ballpark tool online was surprisingly accurate.",
  },
  {
    name: "Dana K.",
    initial: "D",
    color: "#ea580c",
    when: "1 month ago",
    text: "We manage a commercial plaza — Apex re-did our flat TPO membrane with zero disruption to tenants. Fast, clean, and on budget. Our go-to roofer now.",
  },
];

export default function Reviews() {
  return (
    <section className="section bg-slate-50">
      <div className="container-x">
        <div className="text-center">
          <div className="eyebrow">Verified Reviews</div>
          <h2 className="h2 mt-2">Homeowners Rate Us {site.googleRating.toFixed(1)} Stars</h2>
        </div>

        {/* Google-style summary dashboard */}
        <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-6 rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-100">
          <div className="text-center">
            <div className="text-5xl font-extrabold text-brand-navy">
              {site.googleRating.toFixed(1)}
            </div>
            <Stars n={5} />
            <div className="mt-1 text-xs text-slate-500">
              {site.googleReviewCount} Google reviews
            </div>
          </div>
          <div className="h-16 w-px bg-slate-200" />
          <div className="space-y-1">
            {[
              [5, 96],
              [4, 3],
              [3, 1],
              [2, 0],
              [1, 0],
            ].map(([star, pct]) => (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-slate-500">{star}</span>
                <div className="h-2 w-28 overflow-hidden rounded bg-slate-100">
                  <div className="h-full bg-brand-gold" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {REVIEWS.map((r) => (
            <div key={r.name} className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-10 w-10 place-items-center rounded-full font-bold text-white"
                    style={{ background: r.color }}
                  >
                    {r.initial}
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-sm font-bold text-brand-navy">
                      {r.name}
                      <BadgeCheck size={15} className="text-blue-500" />
                    </div>
                    <div className="text-xs text-slate-400">{r.when}</div>
                  </div>
                </div>
                <GoogleG />
              </div>
              <Stars n={5} className="mt-3" />
              <p className="mt-2 text-sm leading-relaxed text-brand-slate">{r.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stars({ n, className = "" }: { n: number; className?: string }) {
  return (
    <div className={`flex ${className}`}>
      {Array.from({ length: n }).map((_, i) => (
        <Star key={i} size={16} className="fill-brand-gold text-brand-gold" />
      ))}
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45 24c0-1.6-.1-3.1-.4-4.6H24v9.1h11.8c-.5 2.8-2 5.1-4.4 6.7v5.6h7.1C42.7 37 45 31 45 24z" />
      <path fill="#34A853" d="M24 46c6 0 11-2 14.5-5.4l-7.1-5.6c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.4v5.7C7.9 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.8 28.1c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.4C2.9 17.1 2 20.4 2 24s.9 6.9 2.4 9.8l7.4-5.7z" />
      <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C35 4.1 30 2 24 2 15.4 2 7.9 6.9 4.4 14.2l7.4 5.7c1.7-5.2 6.5-9.1 12.2-9.1z" />
    </svg>
  );
}
