import Hero from "@/components/Hero";
import ServiceGrid from "@/components/ServiceGrid";
import QuoteWidget from "@/components/QuoteWidget";
import BeforeAfter from "@/components/BeforeAfter";
import Reviews from "@/components/Reviews";
import CTABand from "@/components/CTABand";

export default function HomePage() {
  return (
    <>
      <Hero />

      <ServiceGrid />

      {/* Gated interactive lead capture */}
      <section className="section bg-slate-50">
        <div className="container-x">
          <div className="text-center">
            <div className="eyebrow">No Waiting</div>
            <h2 className="h2 mt-2">Get Your Instant Ballpark Quote</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-500">
              Unlock our satellite roof-mapping tool and see a real-time price
              range — before you ever pick up the phone.
            </p>
          </div>
          <div className="mt-10">
            <QuoteWidget />
          </div>
        </div>
      </section>

      {/* Before / After proof */}
      <section className="section">
        <div className="container-x grid items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="eyebrow">Real Transformations</div>
            <h2 className="h2 mt-2">Drag to See the Difference</h2>
            <p className="mt-3 text-slate-500">
              From weathered, curling asphalt to crisp architectural shingles —
              slide the handle to compare an actual Apex job.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-brand-slate">
              <li>✓ Full tear-off & deck inspection</li>
              <li>✓ Premium underlayment & ventilation</li>
              <li>✓ Completed in as little as one day</li>
            </ul>
          </div>
          <BeforeAfter />
        </div>
      </section>

      <Reviews />

      <CTABand />
    </>
  );
}
