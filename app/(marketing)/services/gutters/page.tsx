import type { Metadata } from "next";
import { Droplets } from "lucide-react";
import ServicePageTemplate, { type ServiceContent } from "@/components/ServicePageTemplate";

export const metadata: Metadata = {
  title: "Seamless Gutter Installation",
  description:
    "Seamless aluminum gutters, downspouts, and leaf guards custom-fit to your home. Protect your foundation and landscaping from water damage.",
};

const content: ServiceContent = {
  title: "Gutter Installation",
  tagline: "Seamless & Custom-Fit",
  heroIcon: <Droplets size={14} />,
  intro:
    "Gutters are your home's first line of defense against water damage. Apex fabricates seamless aluminum gutters on-site for a perfect fit, then adds leaf guards so you never climb a ladder to clean them again.",
  benefits: [
    "Seamless runs — fewer leaks, cleaner lines",
    "Custom-fabricated on-site to your exact roofline",
    "Leaf-guard systems to eliminate clogs",
    "Protects foundation, siding & landscaping",
  ],
  options: [
    {
      name: "5\" Seamless Aluminum",
      desc: "The standard for most homes — durable and available in many colors.",
      priceHint: "$8–$14 / linear ft installed",
    },
    {
      name: "6\" Oversized Seamless",
      desc: "Handles heavy rainfall and large roof areas without overflowing.",
      priceHint: "$12–$18 / linear ft installed",
    },
    {
      name: "Gutter Guards",
      desc: "Micro-mesh and screen guards to keep debris out for good.",
      priceHint: "$6–$12 / linear ft",
    },
  ],
  faqs: [
    {
      q: "Why seamless instead of sectional gutters?",
      a: "Seamless gutters are formed from a single piece of aluminum, so there are far fewer joints to leak or fail over time.",
    },
    {
      q: "Do gutter guards really work?",
      a: "Quality micro-mesh guards dramatically reduce clogs and maintenance. We'll recommend the right system for your tree coverage.",
    },
    {
      q: "Can you match my home's trim color?",
      a: "Yes — we stock a wide range of baked-enamel colors to complement your exterior.",
    },
  ],
  warranty: "Lifetime Workmanship Warranty + 20-year finish warranty",
};

export default function Page() {
  return <ServicePageTemplate c={content} />;
}
