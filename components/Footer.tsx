import Link from "next/link";
import { Phone, Mail, MapPin, Star, ShieldCheck } from "lucide-react";
import { site, services } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="bg-brand-navy text-white/80">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-xl font-extrabold text-white">Apex Roofing</div>
          <p className="mt-3 text-sm">
            Premium residential & commercial roofing serving {site.city} and
            surrounding areas. Licensed & insured — {site.license}.
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-white">
            <Star size={16} className="fill-brand-gold text-brand-gold" />
            {site.googleRating.toFixed(1)} ({site.googleReviewCount} reviews)
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-white">Services</h4>
          <ul className="mt-4 space-y-2 text-sm">
            {services.map((s) => (
              <li key={s.slug}>
                <Link href={s.href} className="hover:text-brand-accent">
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-white">Contact</h4>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <a href={`tel:${site.phoneRaw}`} className="flex items-center gap-2 hover:text-brand-accent">
                <Phone size={16} /> {site.phoneDisplay}
              </a>
            </li>
            <li>
              <a href={`mailto:${site.email}`} className="flex items-center gap-2 hover:text-brand-accent">
                <Mail size={16} /> {site.email}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <MapPin size={16} /> {site.city}
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-white">Guarantee</h4>
          <div className="mt-4 flex items-start gap-2 text-sm">
            <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-gold" />
            <span>
              Lifetime workmanship warranty. 24/7 emergency storm response. No
              money down until the job is done right.
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-white/50 sm:flex-row">
          <span>© {new Date().getFullYear()} Apex Roofing. All rights reserved.</span>
          <span>Demo site — built with Next.js & Tailwind CSS.</span>
        </div>
      </div>
    </footer>
  );
}
