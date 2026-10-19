# Maggie Mae Out Loud — Voice Layer Setup

Maggie already answers the website chat. This layer lets her answer **spoken**
calls, where she qualifies the job, collects the name and address, and files
the lead into the same CRM pipeline the chat widget uses.

Same brain (`lib/maggie.ts`), same lead routing (`lib/leadRouting.ts`). Only
the transport is different, and there are two:

| Transport | What it is | Cost |
|---|---|---|
| **Browser call** (`browser`) | The call widget on the site, using the browser's own speech engines | Free, beyond the Claude calls |
| **Phone line** (Twilio) | A real number a homeowner dials | Per-minute, plus the number |

The browser path is the one in active use; the Twilio half of this document is
kept for when a dialable number is worth paying for.

---

## The browser call

No vendor, no SDK, no account, no per-minute billing. `SpeechRecognition`
listens, `speechSynthesis` speaks, and `/api/voice/turn` does the thinking —
the two speech engines ship with the browser.

```
  visitor speaks
       │
       ▼
  SpeechRecognition  ──POST──▶  /api/voice/turn
  (lib/voiceClient.ts)               │
       ▲                             ├─▶ Claude (Maggie's next line + language)
       │                             └─▶ lib/leadRouting.ts (route/update the lead)
  speechSynthesis    ◀──JSON─────────┘
       │
       ▼
  visitor speaks again ...
```

### Turning it on

```bash
NEXT_PUBLIC_VOICE_PROVIDER=browser   # default is "demo", a scripted simulation
NEXT_PUBLIC_VOICE_OPEN_IN=en         # or "es" to greet in Spanish
ANTHROPIC_API_KEY=sk-ant-...         # the thinking still happens server-side
```

That's the whole setup. No other credentials.

### She switches languages mid-call

The point of this path over a vendor agent: the recognizer's language is a
property we control per turn, so she can follow a caller from English into
Spanish and back.

Every turn, `/api/voice/turn` returns the language it just answered in, and the
widget points both engines there before it listens again — `recognition.lang`
for the ear, a matching `speechSynthesis` voice for the mouth. The server
decides because it holds the prompt, and only it knows what language Maggie
actually wrote. `detectLanguage()` in `lib/maggie.ts` makes the call: strong
markers switch on one word, weak ones need corroboration, and an unclear turn
("okay", "1420", a name) leaves the language where it is — flapping mid-call is
worse than switching a turn late.

### Known limits

**Chrome's recognizer is not on-device.** Chrome and Edge stream microphone
audio to Google's servers; Safari does much the same with Apple. "Built into
the browser" is not "stays on the machine". Say so on the privacy page if the
client's customers would care.

**Firefox can't run it at all.** No `SpeechRecognition` implementation. The
widget throws a clear message there rather than failing silently — the visitor
is pointed at the chat instead.

**HTTPS only** (localhost excepted).

**No barge-in.** The mic is closed while Maggie speaks, because one open mic
next to one speaker means she transcribes herself. The caller has to wait for
her to finish — she's kept to one or two short sentences a turn for exactly
this reason.

**Nothing is stored server-side.** The transcript lives in the tab and is sent
up each turn, so there's no session store to configure. If the tab closes
mid-call, a `pagehide` beacon finalizes the lead on the way out.

---

## The phone line (Twilio)

Twilio handles the telephony, the speech-to-text, and the text-to-speech. We
handle the thinking. Each caller sentence is one HTTP round trip:

```
  caller speaks
       │
       ▼
  Twilio transcribes  ──POST──▶  /api/voice/respond
                                      │
                                      ├─▶ Claude (Maggie's next line)
                                      └─▶ lib/crm.ts (route/update the lead)
                                      │
  Twilio speaks it   ◀──TwiML──────────┘
       │
       ▼
  caller speaks again ...
```

Three endpoints, all POST:

| Endpoint | Twilio setting | Job |
|---|---|---|
| `/api/voice` | **A call comes in** | Pick up, greet, start listening |
| `/api/voice/respond` | *(automatic)* | One turn of conversation |
| `/api/voice/status` | **Call status changes** | Finalize the lead when the call ends |

You only configure the first and third in the Twilio console — Maggie points
Twilio at `/api/voice/respond` herself.

---

## Setup

### 1. Buy a number

In the [Twilio Console](https://console.twilio.com) → **Phone Numbers → Buy a
number**. Any local number with **Voice** capability works. A trial account can
only call *verified* numbers — fine for testing with your own phone, but you
must upgrade before real customers can dial in.

### 2. Copy your credentials

From the console dashboard, copy the **Account SID** and **Auth Token** into
`.env.local` (and into Vercel's environment variables for production):

```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+15125550142
```

> The auth token is not optional in production. It is what proves an incoming
> webhook really came from Twilio. Without it, anyone who discovers the URL can
> POST fake calls straight into the client's CRM and burn API credits. The app
> logs a warning on every unverified request.

### 3. Add a session store (before taking real calls)

A call spans a dozen separate HTTP requests. On Vercel those can land on
different serverless instances, and an in-memory transcript does not survive
the trip — Maggie would re-greet the caller mid-sentence.

Create a free [Upstash Redis](https://upstash.com) database (or a Vercel KV
store) and set:

```
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

Skip this for local testing; do not skip it for a live number.
`GET /api/health` tells you which mode you're in.

### 4. Point the number at the app

Phone Numbers → your number → **Voice Configuration**:

- **A call comes in:** Webhook · `https://YOUR-DOMAIN/api/voice` · **HTTP POST**
- **Call status changes:** `https://YOUR-DOMAIN/api/voice/status` · **HTTP POST**

For the live deployment that's `https://apex-roofing-iota.vercel.app/api/voice`.

### 5. Call it

Dial the number. Maggie picks up on the first ring.

---

## Testing without a phone

Twilio's side of a call is just form-encoded POSTs and XML replies, so the whole
conversation loop can be driven from a terminal:

```bash
npm run dev                                    # terminal 1

npm run simulate-call                          # terminal 2 — storm damage call
npm run simulate-call -- --scenario estimate   # routine estimate
npm run simulate-call -- --scenario silence    # caller says nothing
npm run simulate-call -- --scenario hangup     # caller hangs up mid-call
npm run simulate-call -- --live                # type the caller's lines yourself
npm run simulate-call -- --url https://apex-roofing-iota.vercel.app
```

If `TWILIO_AUTH_TOKEN` is set, the simulator signs its requests exactly the way
Twilio does — so it also verifies that signature checking accepts real traffic
and rejects everything else.

Watch the dev-server log for the `[CRM:*]` payloads and the `[maggie:voice]`
lead summary.

### Testing a real call against localhost

Twilio needs a public URL. Use a tunnel:

```bash
npx ngrok http 3000
```

Then set the Twilio webhooks to the ngrok URL, and set
`TWILIO_WEBHOOK_BASE_URL` to that same URL so signature verification matches
what Twilio signed.

---

## Tuning her phone manner

`buildVoiceSystemPrompt()` in `lib/maggie.ts` is separate from the chat prompt
on purpose. Text and speech are different mediums: emoji and three-sentence
paragraphs are fine to read and terrible to hear. The phone prompt enforces one
question per turn, under ~35 words, no markdown, and reading names and
addresses back for confirmation.

`CUSTOM_KNOWLEDGE` and `lib/site.ts` feed both prompts, so tailoring a client
once covers chat and phone together.

**The voice itself** — `TWILIO_VOICE`, default `Polly.Joanna-Neural`. Amazon's
neural voices sound markedly less robotic than the standard set. Twilio's
console has a preview widget for the full list.

**This transport is English-only.** A `<Gather>` listens in one language and a
`<Say>` speaks in one voice, both fixed for the life of the TwiML document, so
the phone line can't follow a caller into Spanish the way the browser call can.
Maggie's prompt would happily answer in Spanish; Polly.Joanna would then read
it with an American English accent and the next reply would be transcribed by
an English recognizer. Making this path bilingual means picking the voice and
`language` per turn from the session (`Polly.Lupe-Neural` / `es-US`) and
handling the first turn, where a Spanish speaker's opening sentence hits an
English recognizer before anyone knows to switch. Worth doing only if a real
phone number goes live.

---

## Design decisions worth knowing

**The lead is routed on the caller's first sentence, not at the end of the
call.** We have a phone number before they say a word — caller ID. So a storm
call reaches the crew even if the line drops mid-word. The name and address
arrive later as an *upsert* against the same lead id, not a second lead.

**A silent call creates no lead.** Wrong numbers and immediate hang-ups don't
belong in the pipeline.

**Every call finalizes exactly once.** Both a polite goodbye and a dropped line
converge on the same idempotent `finalizeCall`.

**Claude failures never produce silence.** If the API key dies, Maggie falls
back to short scripted lines and keeps the call alive — and `/api/health` flips
to `degraded` so you find out.

---

## Known limits

**Latency.** Each turn is transcribe → think → speak, roughly 1.5–3 seconds of
gap. Acceptable, noticeably slower than a person. Fixing it properly means
streaming audio ([Twilio ConversationRelay](https://www.twilio.com/docs/voice/twiml/connect/conversationrelay)
or Media Streams), which needs a persistent WebSocket server — not something
Vercel's serverless functions can host. Everything below the TwiML helpers in
`lib/voice.ts` is transport-agnostic, so that upgrade replaces one file's top
half and leaves the brain and CRM pipeline untouched.

**No barge-in mid-sentence.** The caller can start talking while Maggie speaks,
but she won't stop to listen. Same fix as above.

**Speech-to-text writes numbers as words.** A caller saying "fourteen twenty
Cedar Hollow" often transcribes as words, not `1420`. The address still reaches
the CRM correctly, just spelled out. Normalizing it is a good next step if the
client's CRM does strict address matching.

**Cost.** Twilio charges per minute inbound plus per speech-recognition
request; Claude Haiku adds a fraction of a cent per turn. A three-minute call
lands around a few cents all-in — but check current Twilio pricing before
quoting a client a monthly number.

---

# The browser call widget

`components/MaggieCall.tsx` — a floating button in the bottom-right that
expands into a calling card, so a visitor can talk to Maggie from the website
without dialling anything. It's the third way to reach her, alongside the text
chat (bottom-left) and the phone line above. All three feed the same brain and
the same CRM pipeline.

Three files, cleanly separated so none of them has to know about the others:

| File | Job |
|---|---|
| `components/MaggieCall.tsx` | Presentation only — states, layout, styling |
| `lib/useMaggieCall.ts` | The state machine, mic permission, audio metering |
| `lib/voiceClient.ts` | The vendor seam — one adapter per provider |

## States

The widget moves through: **idle** (collapsed button) → **ready** (expanded
card) → **requesting-mic** → **connecting** → **active** → **ended**, with
**error** reachable from any step.

Red is reserved for one meaning: *your microphone is open*. It appears on the
live timer, the waveform, and the End call button, and nowhere else. A visitor
can tell at a glance whether they're on an open mic.

The waveform is driven by real audio, not a canned animation. If the vendor
reports speaking volume we use it; if not, the hook meters the caller's own
microphone through a Web Audio analyser. Either way the bars move because
someone is actually talking.

## Plugging in a real voice provider

Out of the box the widget runs `createDemoVoiceClient` — a local simulation
with no credentials and no network, clearly labelled "Demo mode" in the UI
while a call is running. That way the widget is never a dead button in front of
a prospect, and never quietly pretends to be live.

### Vapi

```bash
npm install @vapi-ai/web
```

```
NEXT_PUBLIC_VOICE_PROVIDER=vapi
NEXT_PUBLIC_VAPI_PUBLIC_KEY=pk_...
NEXT_PUBLIC_VAPI_ASSISTANT_ID=...
```

Then uncomment the `loadSdk` line in `resolveVoiceClientFactory()`
(`lib/voiceClient.ts`):

```ts
loadSdk: () => import("@vapi-ai/web"),
```

### Retell AI

```bash
npm install retell-client-js-sdk
```

Retell's API key must stay on the server — the browser gets a per-call token
instead. Set these **without** the `NEXT_PUBLIC_` prefix:

```
NEXT_PUBLIC_VOICE_PROVIDER=retell
RETELL_API_KEY=...
RETELL_AGENT_ID=...
```

`app/api/voice/web-session/route.ts` mints the token. It returns HTTP 501 with
setup instructions until those two vars are set. Uncomment the `loadSdk` line
for Retell in `resolveVoiceClientFactory()`.

> Both adapters are written from each vendor's documented SDK surface, not from
> a live integration — check the current docs when you wire one up. The event
> names and method signatures are the parts most likely to have moved.

### Any other vendor

Write a `VoiceClientFactory` and pass it in. Nothing else changes:

```tsx
<MaggieCall createClient={myLiveKitFactory} />
```

## Props

| Prop | Default | Purpose |
|---|---|---|
| `createClient` | env-selected | The vendor adapter |
| `assistantName` | `"Maggie Mae"` | Rebrand per client |
| `companyName` | `site.name` | Pulled from `lib/site.ts` |
| `position` | `"bottom-right"` | Opposite corner from the chat widget |
| `defaultOpen` | `false` | Start expanded, e.g. on a dedicated landing page |
| `fallbackPhoneRaw` / `Display` | `lib/site.ts` | The "call us instead" escape hatch |
| `onCallStart` / `onCallEnd` / `onError` | — | Analytics hooks |

## Why it's fast on Vercel

The vendor SDK is **never in the main bundle** — it loads on first click, via
dynamic `import()` inside the adapter. The widget adds roughly 0.1 kB to the
homepage's first load; a visitor who never clicks downloads no WebRTC code at
all.

The expanded card isn't server-rendered either. Only the collapsed button ships
in the initial HTML, so there's no hydration cost for a panel nobody has opened.

## Accessibility notes

- Escape collapses the card; focus moves to the primary action on open.
- State changes announce through `aria-live`; errors use `role="alert"`.
- The collapsed button is removed from the tab order while the card is open, so
  the widget presents as one control rather than two.
- The waveform carries an `aria-label` rather than being decorative noise.
- Reduced-motion is respected globally via `app/globals.css`.
- The microphone track is stopped on unmount — the browser's recording
  indicator must never outlive the call.
