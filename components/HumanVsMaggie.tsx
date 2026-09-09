import { Check, X } from "lucide-react";

type Row = { feature: string; human: string; maggie: string };

const ROWS: Row[] = [
  {
    feature: "Year 1 Total Cost",
    human: "$168,000+ (Base salary only)",
    maggie: "$6,564 (Setup + Annual Fee)",
  },
  {
    feature: "Year 2+ Ongoing Cost",
    human: "$168,000+ (/year)",
    maggie: "$3,564 (/year)",
  },
  {
    feature: "Hold Times & Dropped Leads",
    human:
      "High Risk. If multiple emergency calls hit at once, prospects wait on hold or go to voicemail. Most hang up and call the next roofer.",
    maggie:
      "Zero. Handles infinite concurrent calls instantly. No hold times, no busy signals, and zero dropped leads.",
  },
  {
    feature: "Bilingual Call Handling",
    human:
      "Extremely Rare & Expensive. Finding night/weekend receptionists who are completely bilingual is incredibly difficult and drastically drives up hourly wages.",
    maggie:
      "Native & Automatic. Automatically detects the language spoken (English or Spanish) and instantly switches in real time, no lagging, transferring, or pausing.",
  },
  {
    feature: "Storm & Emergency Staffing",
    human:
      "Requires a minimum of 4.2 to 5 employees to cover nights, weekends, and holidays.",
    maggie: "Built in. Automatically active 24/7/365 with no extra scheduling effort.",
  },
  {
    feature: "Sick Days, Holidays & PTO",
    human:
      "Requires temporary agency hires or expensive overtime pay to cover gaps.",
    maggie:
      "Never takes a break. Fully active on Christmas, weekends, and 3:00 AM storm surges.",
  },
  {
    feature: "Lead Capture & CRM",
    human:
      "Manual data entry. Risk of typos, lost sticky notes, or delayed message routing.",
    maggie:
      "Instant data syncing. Drops clean lead details directly into your CRM or scheduling app.",
  },
  {
    feature: "Hidden Overheads",
    human:
      "Recruiter fees, payroll taxes, health insurance, management overhead, and office equipment.",
    maggie: "None. Fixed, predictable software pricing.",
  },
];

export default function HumanVsMaggie() {
  return (
    <section className="section bg-brand-navy text-white">
      <div className="container-x">
        <div className="text-center">
          <div className="eyebrow text-brand-accent">
            Human Team vs. Maggie Mae
          </div>
          <h2 className="h2 mt-2">You Stop Roof Leaks, I Stop Lead Leaks.</h2>
          <p className="mt-3 text-white/70">
            24/7/365 Coverage: Human Staffing vs. Maggie Mae AI
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-xl border border-white/10">
          {/* Desktop column headers */}
          <div className="hidden md:grid md:grid-cols-[1.2fr_1fr_1fr] bg-white/[0.03] text-xs font-semibold uppercase tracking-wider text-white/60">
            <div className="p-4">Feature</div>
            <div className="p-4">Human Receptionist Team</div>
            <div className="p-4 bg-brand-accent/10 text-brand-accent">
              Maggie Mae AI
            </div>
          </div>

          <dl className="divide-y divide-white/10">
            {ROWS.map((row) => (
              <div
                key={row.feature}
                className="grid gap-3 p-5 md:grid-cols-[1.2fr_1fr_1fr] md:gap-0 md:p-0"
              >
                <dt className="text-base font-semibold md:border-r md:border-white/10 md:p-5">
                  {row.feature}
                </dt>
                <dd className="text-sm text-white/80 md:border-r md:border-white/10 md:p-5">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/50 md:hidden">
                    Human Team
                  </div>
                  <div className="flex gap-2">
                    <X
                      aria-hidden
                      className="mt-0.5 h-4 w-4 flex-none text-white/40"
                    />
                    <span>{row.human}</span>
                  </div>
                </dd>
                <dd className="text-sm text-white md:bg-brand-accent/5 md:border-l md:border-brand-accent/40 md:p-5">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-accent md:hidden">
                    Maggie AI
                  </div>
                  <div className="flex gap-2">
                    <Check
                      aria-hidden
                      className="mt-0.5 h-4 w-4 flex-none text-brand-accent"
                    />
                    <span>{row.maggie}</span>
                  </div>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
