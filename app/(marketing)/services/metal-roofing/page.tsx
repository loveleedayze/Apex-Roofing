import type { Metadata } from "next";
import { Zap } from "lucide-react";
import ServicePageTemplate, { type ServiceContent } from "@/components/ServicePageTemplate";

export const metadata: Metadata = {
  title: "Metal Roofing",
  description:
    "Standing seam & metal panel roofing that lasts 50+ years. Energy-efficient, storm-proof, and stunning. Free estimates from Apex Roofing.",
};

const content: ServiceContent = {
  title: "Metal Roofing",
  tagline: "50+ Year Lifespan",
  heroIcon: <Zap size={14} />,
  intro:
    "Standing seam metal is the premium choice for homeowners who never want to re-roof again. Energy-efficient, virtually maintenance-free, and rated for the harshest wind and hail — with a sleek, modern look that boosts home value.",
  benefits: [
    "50+ year lifespan — often the last roof you'll buy",
    "Reflects heat to lower cooling bills",
    "Class 4 impact & up to 140 mph wind ratings",
    "Non-combustible and fully recyclable",
  ],
  options: [
    {
      name: "Exposed Fastener Panels",
      desc: "Cost-effective ag-panel style, ideal for barns, porches, and budgets.",
      priceHint: "$8–$12 / sq ft installed",
    },
    {
      name: "Standing Seam",
      desc: "Concealed fasteners, clean vertical lines — our flagship metal system.",
      priceHint: "$12–$18 / sq ft installed",
    },
    {
      name: "Metal Shingle / Stone-Coated",
      desc: "The look of shingle or tile with the toughness of steel.",
      priceHint: "$13–$20 / sq ft installed",
    },
  ],
  faqs: [
    {
      q: "Is metal roofing noisy in the rain?",
      a: "No. With solid decking and underlayment, a metal roof is no louder than shingles.",
    },
    {
      q: "Can you install metal over my existing roof?",
      a: "Sometimes, but we generally recommend a full tear-off to inspect the deck and maximize lifespan.",
    },
    {
      q: "Will a metal roof lower my insurance?",
      a: "Often yes — many carriers offer discounts for Class 4 impact-resistant metal roofing.",
    },
  ],
  warranty: "Lifetime Workmanship Warranty + up to 40-year finish warranty",
};

export default function Page() {
  return <ServicePageTemplate c={content} />;
}
