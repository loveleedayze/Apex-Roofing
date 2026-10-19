import { NextResponse } from "next/server";
import { getHealth } from "@/lib/health";
import { MODEL } from "@/lib/maggie";
import { storeMode } from "@/lib/callStore";
import { VOICE } from "@/lib/voice";

// GET /api/health
//
// Is Maggie actually thinking, or just reciting canned lines?
//
// Point an uptime monitor (UptimeRobot, Better Stack, Pingdom — anything that
// can watch an HTTP status) at this URL. It returns 503 the moment Claude
// starts failing, which is the alarm the silent fallback never gave us:
//
//   live     → 200  Claude is answering.
//   demo     → 200  No API key configured. Intentional — canned replies.
//   degraded → 503  A key IS set but calls are failing. SOMETHING IS BROKEN.
//
// `degraded` means visitors are being served canned replies while the site
// looks perfectly healthy. That is the failure worth waking up for.
export const dynamic = "force-dynamic"; // never cache a health check

export async function GET() {
  const health = getHealth();

  return NextResponse.json(
    {
      service: "maggie-mae",
      model: MODEL,
      ...health,
      // The phone line's two ways to fail quietly. `webhookVerified: false`
      // means anyone who finds the URL can forge calls; `sessionStore:
      // "memory"` means transcripts vanish between serverless instances and
      // Maggie re-greets callers mid-call. Both look fine until they don't.
      voice: {
        ttsVoice: VOICE,
        webhookVerified: Boolean(process.env.TWILIO_AUTH_TOKEN),
        sessionStore: storeMode,
        warnings: [
          !process.env.TWILIO_AUTH_TOKEN &&
            "TWILIO_AUTH_TOKEN unset — voice webhooks are NOT verified as coming from Twilio.",
          storeMode === "memory" &&
            "Call sessions are in-memory only — fine locally, unreliable on serverless. Set UPSTASH_REDIS_REST_URL/TOKEN before taking real calls.",
        ].filter(Boolean),
      },
      hint: {
        live: "Claude is answering normally.",
        demo: "No ANTHROPIC_API_KEY set — running canned rule-based replies on purpose.",
        degraded:
          "A key is configured but Claude calls are FAILING. Visitors are getting canned replies. See the server logs for the cause.",
      }[health.mode],
    },
    { status: health.healthy ? 200 : 503 },
  );
}
