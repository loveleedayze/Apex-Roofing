// Central place for business facts so every page/CTA stays in sync.
export const site = {
  name: "Apex Roofing",
  yearsInBusiness: 18,
  googleRating: 5.0,
  googleReviewCount: 412,
  // Raw digits for tel: links, formatted string for display.
  phoneRaw: "+15551237663",
  phoneDisplay: "(555) 123-ROOF",
  email: "estimates@apexroofing.com",
  city: "Austin, TX",
  license: "TX-RC-0098421",
  // Short header sub-label under the logo.
  tagline: "Roofing • Storm • Gutters",
  // Maggie answers in each of these languages and switches the moment a
  // customer does, so the site says so in several places. They all read from
  // here — a client who doesn't want a language advertised changes these lines
  // and the claim disappears everywhere at once.
  languages: "English, Español, 한국어, Tiếng Việt & 中文",
  spanishLine: "Se habla español",
  koreanLine: "한국어 상담 가능",
  vietnameseLine: "Có nói tiếng Việt",
  chineseLine: "提供中文服务",
};

export const services = [
  {
    slug: "asphalt-shingles",
    title: "Asphalt Shingles",
    short: "Architectural shingle roofing",
    href: "/services/asphalt-shingles",
  },
  {
    slug: "metal-roofing",
    title: "Metal Roofing",
    short: "Standing seam & metal panels",
    href: "/services/metal-roofing",
  },
  {
    slug: "flat-tpo",
    title: "Flat TPO Commercial",
    short: "Commercial membrane systems",
    href: "/services/flat-tpo",
  },
  {
    slug: "gutters",
    title: "Gutter Installation",
    short: "Seamless gutters & guards",
    href: "/services/gutters",
  },
];
