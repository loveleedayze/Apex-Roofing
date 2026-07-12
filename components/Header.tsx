"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, Phone, Menu, X, ShieldCheck, ChevronRight } from "lucide-react";
import { site, services } from "@/lib/site";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 shadow-sm">
      {/* -------- Top utility bar: trust stats + URGENT call button -------- */}
      <div className="bg-brand-navy text-white">
        <div className="container-x flex items-center justify-between gap-3 py-2 text-sm">
          {/* Left: trust stats */}
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 font-semibold">
              <Star size={16} className="fill-brand-gold text-brand-gold" />
              {site.googleRating.toFixed(1)} Google Rating
            </span>
            <span className="hidden items-center gap-1 text-white/80 sm:flex">
              <ShieldCheck size={16} className="text-brand-gold" />
              Over {site.yearsInBusiness} Years in Business
            </span>
          </div>

          {/* Right: high-contrast URGENT call button — native tel: on tap */}
          <a
            href={`tel:${site.phoneRaw}`}
            className="btn animate-pulse bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-cta hover:bg-red-700 sm:text-sm"
            aria-label="Call now for urgent roofing needs"
          >
            <Phone size={15} />
            <span>CALL NOW / URGENT</span>
          </a>
        </div>
      </div>

      {/* -------- Main navigation header -------- */}
      <div className="bg-white/95 backdrop-blur border-b border-slate-100">
        <div className="container-x flex items-center justify-between py-3">
          <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <Logo />
            <div className="leading-tight">
              <div className="text-lg font-extrabold text-brand-navy">{site.name}</div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-brand-accent">
                {site.tagline}
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 lg:flex">
            {services.map((s) => (
              <Link
                key={s.slug}
                href={s.href}
                className="text-sm font-semibold text-brand-slate hover:text-brand-accent"
              >
                {s.title}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Secondary CTA for routine work */}
            <Link href="/#quote" className="hidden btn-outline text-sm sm:inline-flex">
              Request Free Estimate
            </Link>
            {/* Mobile menu toggle */}
            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-md p-2 text-brand-navy lg:hidden"
              aria-label="Toggle menu"
              aria-expanded={open}
            >
              {open ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {open && (
          <nav className="border-t border-slate-100 bg-white lg:hidden">
            <div className="container-x flex flex-col py-2">
              {services.map((s) => (
                <Link
                  key={s.slug}
                  href={s.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between py-3 text-sm font-semibold text-brand-slate"
                >
                  {s.title}
                  <ChevronRight size={16} className="text-slate-300" />
                </Link>
              ))}
              <Link
                href="/#quote"
                onClick={() => setOpen(false)}
                className="btn-cta my-3"
              >
                Request Free Estimate
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

/** Lightweight inline SVG logo (no image request). */
function Logo() {
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect width="48" height="48" rx="10" className="fill-brand-navy" />
      <path d="M24 10 L40 24 H33 V37 H15 V24 H8 Z" className="fill-brand-accent" />
      <rect x="21" y="28" width="6" height="9" className="fill-brand-navy" />
    </svg>
  );
}
