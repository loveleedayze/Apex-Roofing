// ---------------------------------------------------------------------------
// Maggie's health signal
// ---------------------------------------------------------------------------
// Maggie falls back to canned rule-based replies whenever the Claude call
// fails, so the widget never breaks in front of a visitor. That's the right
// behavior — but on its own it's dangerous, because a dead API key or an
// exhausted balance looks *exactly* like a working site. Every visitor quietly
// gets a dumb robot and nobody finds out.
//
// So the fallback stays, and we record why it happened. Three states:
//
//   live     — Claude is answering. All good.
//   demo     — No ANTHROPIC_API_KEY at all. Intentional (fresh clone, demo).
//   degraded — A key IS set but the calls are failing. Something is WRONG:
//              expired key, no credits, network down, bad model id.
//
// `degraded` is the one that should page someone. Check GET /api/health.
// ---------------------------------------------------------------------------

export type MaggieMode = "live" | "demo" | "degraded";

type HealthState = {
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  totalFailures: number;
};

// Module-level, so it survives across requests within a server instance.
// NOTE: on serverless (Vercel) each instance keeps its own counters and they
// reset on cold start. Good enough to catch a sustained outage; for real
// alerting, ship these to your monitoring platform.
const state: HealthState = {
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  consecutiveFailures: 0,
  totalFailures: 0,
};

export function recordClaudeSuccess() {
  if (state.consecutiveFailures > 0) {
    console.log(
      `[maggie:health] ✅ RECOVERED — Claude is answering again after ${state.consecutiveFailures} failure(s).`,
    );
  }
  state.lastSuccessAt = new Date().toISOString();
  state.consecutiveFailures = 0;
  state.lastError = null;
}

export function recordClaudeFailure(err: unknown) {
  state.consecutiveFailures += 1;
  state.totalFailures += 1;
  state.lastErrorAt = new Date().toISOString();
  state.lastError = describe(err);

  // Loud, unmissable, and actionable. The old code logged a bare stack trace
  // that was easy to scroll past while the site looked fine.
  console.error(
    [
      "",
      "╔══════════════════════════════════════════════════════════════════╗",
      "║  ⚠️  MAGGIE IS DEGRADED — visitors are getting CANNED replies    ║",
      "╚══════════════════════════════════════════════════════════════════╝",
      `  Consecutive failures : ${state.consecutiveFailures}`,
      `  Reason               : ${state.lastError}`,
      `  Likely cause         : ${diagnose(err)}`,
      "  She is still answering, but NOT with AI. Fix this.",
      "",
    ].join("\n"),
  );
}

export function getHealth() {
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  let mode: MaggieMode;
  if (!hasKey) mode = "demo";
  else if (state.consecutiveFailures > 0) mode = "degraded";
  else mode = "live";

  return {
    mode,
    healthy: mode !== "degraded",
    keyConfigured: hasKey,
    ...state,
  };
}

export function isDegraded() {
  return getHealth().mode === "degraded";
}

function describe(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

/** Turn an SDK error into something a human can act on. */
function diagnose(err: unknown): string {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  const status = (err as { status?: number })?.status;
  const cause = String((err as { cause?: unknown })?.cause ?? "");

  if (status === 401) return "Invalid or revoked API key — check ANTHROPIC_API_KEY in .env.local";
  if (status === 403) return "API key lacks permission for this model";
  if (status === 404) return "Unknown model id — check MODEL in lib/maggie.ts";
  if (status === 429) return "Rate limited — too many requests";
  if (status === 400 && /credit|balance/i.test(msg)) return "Out of credits — top up at console.anthropic.com";
  if (status && status >= 500) return "Anthropic API outage — check status.anthropic.com";
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg + cause)) return "DNS failure — this machine cannot resolve api.anthropic.com (internet down?)";
  if (/timeout|ETIMEDOUT/i.test(msg)) return "Request timed out — slow or dropped connection";
  if (/ECONNREFUSED|ENETUNREACH|fetch failed/i.test(msg + cause)) return "Cannot reach the network";
  return "Unrecognized failure — see the stack trace above";
}
