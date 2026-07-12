# Apex Roofing — Lead-Gen Demo Site

A production-ready, mobile-first lead generation site for a premium roofing
company, built with **Next.js (App Router)**, **Tailwind CSS**, and
**Lucide icons**. Everything is optimized for speed (pure-SVG assets, system
fonts, no external image requests) and conversion.

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
# production build
npm run build && npm start
```

> Requires Node 18.17+.

## Pages (dedicated SEO silos)

| Route | Purpose |
|-------|---------|
| `/` | Homepage: hero, services, gated quote widget, before/after, reviews |
| `/services/asphalt-shingles` | Asphalt shingle silo |
| `/services/metal-roofing` | Metal roofing silo |
| `/services/flat-tpo` | Flat TPO commercial silo |
| `/services/gutters` | Gutter installation silo |

## Key features

- **Sticky conversion header** — trust stats (⭐ 5.0, 18 yrs) on the left, a
  high-contrast **CALL NOW / URGENT** button that uses the native `tel:`
  protocol on the right, plus a secondary **Request Free Estimate** CTA.
- **Gated "Instant Roof Ballpark Quote" widget** (`components/QuoteWidget.tsx`)
  — the interactive satellite roof-mapping calculator is locked until the
  visitor submits **Name + Email + Phone**. On submit the lead is POSTed to
  `/api/lead` and the calculator is revealed.
- **Maggie, the AI Receptionist** (`components/MaggieChat.tsx`) — a persistent
  chat widget anchored **bottom-left**, with a seeded transcript showing how she
  qualifies storm damage vs. routine estimates. Messages hit `/api/chat`.
- **Before/After slider** and a **Google-style reviews dashboard** — both
  rendered with inline SVG, no image downloads.

## Backend / CRM integration

- `app/api/lead/route.ts` — captures quote + estimate leads.
- `app/api/chat/route.ts` — powers Maggie and finalizes qualified chat leads.
- `lib/crm.ts` — normalizes every lead and fans it out to **JobNimbus** and
  **AccuLynx** payload adapters plus a generic Zapier channel via
  `dispatchToCRMs()`.

### Demo vs. live mode

With no env vars set (see `.env.example`), the app runs in **demo mode**: it
structures the exact CRM payloads and logs them to the server console instead of
POSTing. Add a webhook URL to `JOBNIMBUS_WEBHOOK_URL`, `ACCULYNX_WEBHOOK_URL`,
or `ZAPIER_WEBHOOK_URL` to deliver leads live.

## Performance notes

- All imagery is inline SVG → zero image HTTP requests.
- System font stack → no web-font blocking.
- Client JS limited to the few genuinely interactive components.
