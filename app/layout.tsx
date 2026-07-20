import type { Metadata, Viewport } from "next";
import "./globals.css";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    default: `${site.name} — Premium Roofing & Storm Repair | ${site.city}`,
    template: `%s | ${site.name}`,
  },
  description: `${site.name} installs asphalt shingle, metal, and flat TPO commercial roofs plus seamless gutters. ${site.googleRating}★ rated, ${site.yearsInBusiness}+ years, free estimates and 24/7 storm response.`,
  keywords: [
    "roofing",
    "roof repair",
    "asphalt shingles",
    "metal roofing",
    "TPO commercial roofing",
    "gutter installation",
    "storm damage roof",
  ],
  openGraph: {
    title: `${site.name} — Premium Roofing`,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1b2b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Chrome (header/footer/chat) lives in the (marketing) group so the
          demo dashboard at /demo can render its own full-screen shell. */}
      <body>{children}</body>
    </html>
  );
}
