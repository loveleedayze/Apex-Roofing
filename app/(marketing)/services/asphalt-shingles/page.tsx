import type { Metadata } from "next";
import { Layers } from "lucide-react";
import ServicePageTemplate, { type ServiceContent } from "@/components/ServicePageTemplate";

export const metadata: Metadata = {
  title: "Asphalt Shingle Roofing",
  description:
    "Architectural asphalt shingle roof installation & replacement. Dozens of colors, lifetime workmanship warranty, and same-day inspections.",
};

const content: ServiceContent = {
  title: "Asphalt Shingle Roofing",
  tagline: "America's #1 Roof",
  heroIcon: <Layers size={14} />,
  intro:
    "Architectural asphalt shingles deliver the best balance of durability, curb appeal, and value. Apex installs top-tier GAF, Owens Corning, and CertainTeed systems with premium underlayment and proper ventilation for maximum lifespan.",
  benefits: [
    "30–50 year manufacturer shingle warranties",
    "Dozens of designer colors & profiles",
    "Class 4 impact-resistant options for hail country",
    "Complete tear-off, deck repair & ventilation upgrade",
  ],
  options: [
    {
      name: "3-Tab Shingles",
      desc: "Budget-friendly, uniform look. Great for rentals and quick replacements.",
      priceHint: "$4.50–$6.50 / sq ft installed",
    },
    {
      name: "Architectural Shingles",
      desc: "Our most popular pick — dimensional, wind-rated, and beautiful.",
      priceHint: "$6–$9 / sq ft installed",
    },
    {
      name: "Designer / Impact-Resistant",
      desc: "Luxury profiles and Class 4 hail protection for insurance discounts.",
      priceHint: "$9–$13 / sq ft installed",
    },
  ],
  faqs: [
    {
      q: "How long does a shingle roof replacement take?",
      a: "Most residential re-roofs are completed in a single day. Larger or steeper homes may take two.",
    },
    {
      q: "Will insurance cover my new roof?",
      a: "If your roof was damaged by hail or wind, very likely. Our team documents the damage and manages the entire claim with your adjuster.",
    },
    {
      q: "What's the lifespan of architectural shingles?",
      a: "Typically 25–30 years with proper ventilation and maintenance — often longer in milder climates.",
    },
  ],
  warranty: "Lifetime Workmanship Warranty + up to 50-year material coverage",
};

export default function Page() {
  return <ServicePageTemplate c={content} />;
}
