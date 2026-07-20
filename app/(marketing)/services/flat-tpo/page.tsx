import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import ServicePageTemplate, { type ServiceContent } from "@/components/ServicePageTemplate";

export const metadata: Metadata = {
  title: "Flat TPO Commercial Roofing",
  description:
    "Energy-efficient TPO membrane roofing for flat & low-slope commercial buildings. Repairs, restorations, and full re-roofs with zero tenant disruption.",
};

const content: ServiceContent = {
  title: "Flat TPO Commercial Membranes",
  tagline: "Commercial & Low-Slope",
  heroIcon: <Building2 size={14} />,
  intro:
    "For flat and low-slope commercial buildings, Apex installs heat-welded TPO membrane systems that are watertight, energy-efficient, and built to last. From warehouses to retail plazas, we minimize downtime and protect your bottom line.",
  benefits: [
    "Highly reflective — cuts cooling costs on flat roofs",
    "Heat-welded seams for a fully watertight envelope",
    "Leak repair, restoration coatings & full re-roofs",
    "Scheduled around your tenants and operations",
  ],
  options: [
    {
      name: "TPO Repair & Patching",
      desc: "Seam repairs, puncture patches, and flashing fixes to stop leaks fast.",
      priceHint: "From $500 / service call",
    },
    {
      name: "Restoration Coating",
      desc: "Extend roof life with a seamless reflective coating — no tear-off.",
      priceHint: "$3–$6 / sq ft",
    },
    {
      name: "Full TPO Re-Roof",
      desc: "New insulation + membrane system with manufacturer warranty.",
      priceHint: "$7–$12 / sq ft installed",
    },
  ],
  faqs: [
    {
      q: "How long does a commercial TPO roof last?",
      a: "A properly installed TPO membrane typically lasts 20–30 years depending on thickness and maintenance.",
    },
    {
      q: "Can you work around our business hours?",
      a: "Absolutely. We schedule phased work and after-hours crews to keep tenants operating.",
    },
    {
      q: "Do you offer maintenance programs?",
      a: "Yes — annual inspection plans catch small issues before they become costly leaks.",
    },
  ],
  warranty: "Manufacturer NDL warranty (up to 30 yrs) + Apex workmanship guarantee",
};

export default function Page() {
  return <ServicePageTemplate c={content} />;
}
