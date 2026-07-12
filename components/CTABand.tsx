import Link from "next/link";
import { Phone } from "lucide-react";
import { site } from "@/lib/site";

export default function CTABand({
  title = "Storm damage or planning ahead? Let's talk.",
  subtitle = "Free inspection, honest pricing, and no pressure. Reach a real person 24/7.",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="bg-brand-accent">
      <div className="container-x flex flex-col items-center gap-6 py-12 text-center text-white sm:flex-row sm:justify-between sm:text-left">
        <div>
          <h2 className="text-2xl font-extrabold sm:text-3xl">{title}</h2>
          <p className="mt-1 text-white/90">{subtitle}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <a
            href={`tel:${site.phoneRaw}`}
            className="btn bg-white px-6 py-3 font-bold text-brand-accentDark hover:bg-orange-50"
          >
            <Phone size={18} /> {site.phoneDisplay}
          </a>
          <Link
            href="/#quote"
            className="btn border-2 border-white px-6 py-3 font-bold text-white hover:bg-white/10"
          >
            Free Estimate
          </Link>
        </div>
      </div>
    </section>
  );
}
