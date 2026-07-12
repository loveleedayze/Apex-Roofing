# Onboarding a New Roofer (White-Label Guide)

This site is a resellable template. To spin up a new client, you customize a
handful of files, set two environment variables, and deploy. Budget ~15–30
minutes per client (most of it is gathering the client's real content).

There are **3 config files** + **content** + **deploy**. Work top to bottom.

---

## 1. Business facts — `lib/site.ts`  ⭐ the main file

Everything here propagates automatically across the header, footer, hero, chat
widget, and Maggie's knowledge. Edit every field:

| Field | What it is |
|---|---|
| `name` | Company name (appears in header, footer, hero, chat, © line) |
| `yearsInBusiness` | Shown in trust badges |
| `googleRating` / `googleReviewCount` | Star rating + review count |
| `phoneRaw` | Digits only, e.g. `+15125550199` — powers tap-to-call `tel:` links |
| `phoneDisplay` | Formatted, e.g. `(512) 555-0199` — what visitors see |
| `email` | Contact email (footer `mailto:`) |
| `city` | Primary service area |
| `license` | Contractor license # |
| `tagline` | Short sub-label under the logo |

You can also edit the `services` array (slug, title, short description, href) if
the client offers a different mix. **Note:** each service in the array needs a
matching page folder under `app/services/<slug>/` — add or remove folders to
match.

## 2. Brand colors + logo — `tailwind.config.js`

Change the `theme.extend.colors.brand` palette to the client's colors:

- `navy` / `slate` / `steel` — dark base tones
- `accent` / `accentDark` — the primary CTA color (buttons)
- `gold` — highlight accent

The inline SVG logo in `components/Header.tsx` (`<Logo />`) uses these brand
colors automatically, so it recolors with the palette. Swap the SVG `<path>`
shapes if the client has their own mark.

## 3. Maggie the AI receptionist — `lib/maggie.ts`

- `CUSTOM_KNOWLEDGE` — plain-English facts Maggie should know (hours, exact
  service area, financing, warranties, insurance-claim help). This is how you
  "train" her — no ML required.
- `MODEL` — `claude-opus-4-8` (default) or `claude-haiku-4-5` (cheaper/faster
  for high chat volume).
- The company facts come from `lib/site.ts` automatically — don't repeat them.

---

## 4. Replace the demo content

These are marketing/sample content, unique per client — not auto-filled:

- **Testimonials** — `components/Reviews.tsx` (the `reviews` array). Replace with
  the client's real reviews.
- **Service descriptions** — `app/services/*/page.tsx` (the marketing copy at the
  top of each). Rewrite for the client's offerings.
- **Homepage before/after** — `components/BeforeAfter.tsx` is an inline SVG
  illustration; swap for the client's real before/after if they have one.

> Tip: grep the repo for the demo brand to catch any stragglers:
> `git grep -i "apex"` — anything left is content to rewrite.

---

## 5. Environment variables

Set these in the client's Vercel project (Settings → Environment Variables),
never in the code. See `.env.example` for the full list.

| Variable | Purpose | If unset |
|---|---|---|
| `ANTHROPIC_API_KEY` | Powers real Maggie (get one at console.anthropic.com) | Maggie falls back to rule-based demo replies |
| `JOBNIMBUS_WEBHOOK_URL` | Deliver leads to JobNimbus | — |
| `ACCULYNX_WEBHOOK_URL` | Deliver leads to AccuLynx | — |
| `ZAPIER_WEBHOOK_URL` | Generic catch-all → email/SMS/Sheets | — |

Set **at least one** CRM webhook, or leads are only logged (demo mode). Zapier is
the easiest universal option.

---

## 6. Deploy

1. Push the customized repo (or a per-client copy) to GitHub.
2. Import into Vercel — Next.js is auto-detected, no build config needed.
3. Add the environment variables from step 5.
4. Add the client's custom domain under Vercel → Domains (free SSL).

---

## Quick checklist per client

- [ ] `lib/site.ts` — every field updated
- [ ] `tailwind.config.js` — brand colors
- [ ] `lib/maggie.ts` — `CUSTOM_KNOWLEDGE` tailored
- [ ] Testimonials, service copy, before/after replaced
- [ ] `git grep -i "apex"` returns nothing
- [ ] `ANTHROPIC_API_KEY` + a CRM webhook set in Vercel
- [ ] Custom domain connected
- [ ] Test: submit the quote form + chat with Maggie, confirm a lead arrives
