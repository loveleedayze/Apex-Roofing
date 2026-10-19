import { NextResponse } from "next/server";

// POST /api/voice/web-session
//
// Mints a short-lived access token for a browser voice call.
//
// This route exists because the vendor API key must never reach the browser.
// The widget asks this endpoint for a token, the vendor hands the browser a
// session scoped to one call, and the key stays on the server. Vapi's public
// key flow doesn't need this; Retell's does, as does any provider where the
// browser credential is minted per call.
//
// It is a STUB. Fill in the block below with your provider's create-web-call
// request, keep the key in an env var, and never return anything but the token.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const apiKey = process.env.RETELL_API_KEY;
  const agentId = process.env.RETELL_AGENT_ID;

  if (!apiKey || !agentId) {
    return NextResponse.json(
      {
        error: "Voice web sessions are not configured.",
        fix: "Set RETELL_API_KEY and RETELL_AGENT_ID (server-side, not NEXT_PUBLIC_), then set NEXT_PUBLIC_VOICE_PROVIDER=retell. See VOICE.md.",
      },
      { status: 501 },
    );
  }

  try {
    // Verify the current request shape against your provider's docs before
    // trusting this — vendor endpoints move, and this one is written from the
    // documented v2 create-web-call shape rather than a live integration.
    const res = await fetch("https://api.retellai.com/v2/create-web-call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ agent_id: agentId }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[maggie:voice] create-web-call failed ${res.status}: ${detail}`);
      return NextResponse.json({ error: "Could not start a call session." }, { status: 502 });
    }

    const data = await res.json();

    // Return the token and nothing else. The full vendor response can carry
    // account details that have no business in a browser.
    return NextResponse.json({ accessToken: data.access_token });
  } catch (err) {
    console.error("[maggie:voice] create-web-call threw:", err);
    return NextResponse.json({ error: "Could not start a call session." }, { status: 502 });
  }
}
