import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { routeLeadTurn } from "@/lib/leadRouting";
import { recordClaudeSuccess, recordClaudeFailure, getHealth } from "@/lib/health";
import {
  buildSystemPrompt,
  MODEL,
  detectIntent,
  conversationLanguage,
  LANGUAGE_NAME,
} from "@/lib/maggie";
import type { Intent, Lang, TranscriptItem } from "@/lib/maggie";
import { site } from "@/lib/site";

// POST /api/chat
// Two jobs:
//  1) Return Maggie's next reply. With ANTHROPIC_API_KEY set she's a real
//     Claude-powered receptionist; without it she falls back to rule-based
//     demo replies so the site always works.
//  2) When a transcript qualifies a lead, push the full context to the CRMs.
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { message, transcript, contact, finalize, leadId, leadMissing } = body || {};

  // Which language this conversation is being held in. Returned to the widget
  // as well as recorded on the lead: a spoken client needs it to point speech
  // recognition and the synthesized voice at the right language, and the crew
  // needs it to know who to put on the callback.
  const lang = conversationLanguage(transcript, message);
  const language = LANGUAGE_NAME[lang];

  // Maggie's reply (Claude when configured, rule-based otherwise).
  const reply = await generateReply(message, transcript, lang);

  // --- Lead routing -------------------------------------------------------
  // A phone number is enough to route: an urgent storm lead should reach the
  // crew immediately, not wait for the visitor to finish spelling their name.
  // So we send on the first phone number, then push updates under the same
  // lead id as the remaining details arrive.
  const isNewLead = Boolean(finalize) && Boolean(contact?.phone);
  const isEnrichment = typeof leadId === "string" && leadId.length > 0;

  if (isNewLead || isEnrichment) {
    // Reading the transcript, qualifying it and delivering it lives in
    // lib/leadRouting.ts, shared with the call widget — the language is passed
    // in from the live conversation rather than re-guessed there, so it
    // survives a visitor who switched languages in their last message.
    const routed = await routeLeadTurn({
      source: "maggie_chat",
      transcript,
      latest: message,
      contact,
      leadId: isEnrichment ? leadId : undefined,
      leadMissing,
      language,
      channel: "maggie_ai_receptionist",
    });

    return NextResponse.json({
      ok: true,
      reply,
      language,
      leadId: routed.leadId,
      priority: routed.priority,
      isUpdate: routed.isUpdate,
      // The widget echoes this back so we can tell when new details land.
      leadMissing: routed.leadMissing,
      deliveries: routed.deliveries,
      mode: getHealth().mode,
    });
  }

  return NextResponse.json({ ok: true, reply, language, mode: getHealth().mode });
}

// Generate Maggie's next line. Uses Claude when a key is configured; on any
// failure (or no key) it falls back to the rule-based replies below so the
// widget never breaks in a live demo.
async function generateReply(
  message: unknown,
  transcript?: TranscriptItem[],
  lang: Lang = "en",
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback = () => replyFor(detectIntent(String(message || "")), false, lang);

  if (!apiKey) return fallback();

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: "disabled" }, // snappy replies for a live chat widget
      system: buildSystemPrompt(),
      messages: toClaudeMessages(transcript, message),
    });
    const textBlock = res.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    const text = textBlock?.text?.trim();
    if (!text) {
      // Claude answered, but with nothing usable. Still a failure to serve.
      recordClaudeFailure(new Error("Claude returned an empty response"));
      return fallback();
    }
    recordClaudeSuccess();
    return text;
  } catch (err) {
    // The fallback keeps the widget alive, but this must NOT be silent —
    // an expired key or empty balance looks identical to a healthy site.
    recordClaudeFailure(err);
    console.error("[maggie] stack trace:", err);
    return fallback();
  }
}

// Convert the widget transcript into Claude's message format. Claude requires
// the first message to come from the user, so drop any leading assistant turns
// (the widget seeds the conversation with Maggie's greeting).
function toClaudeMessages(
  transcript: TranscriptItem[] | undefined,
  latest: unknown,
): Anthropic.MessageParam[] {
  const items =
    Array.isArray(transcript) && transcript.length
      ? transcript
      : [{ role: "user" as const, text: String(latest || "") }];

  const mapped: Anthropic.MessageParam[] = items.map((m) => ({
    role: m.role === "maggie" ? ("assistant" as const) : ("user" as const),
    content: m.text,
  }));

  while (mapped.length && mapped[0].role === "assistant") mapped.shift();
  if (!mapped.length) mapped.push({ role: "user", content: String(latest || "") });
  return mapped;
}

// ---------------------------------------------------------------------------
// Rule-based fallback
// ---------------------------------------------------------------------------
// Intent detection, language detection, and transcript-reading now live in
// lib/maggie.ts, shared with the call widget so a storm lead is tagged urgent
// whether it arrives by chat or by voice, in English, Spanish or Korean. These
// canned lines are chat-specific — the spoken channel has its own, written to
// be heard rather than read.
//
// The Spanish and Korean sets are not a translation exercise: this is what a visitor sees
// when the API key has died mid-demo, so it has to sound like the same
// receptionist, not like a machine that gave up and switched languages.

function replyFor(intent: Intent, finalized: boolean, lang: Lang = "en"): string {
  if (lang === "es") return replyForEs(intent, finalized);
  if (lang === "ko") return replyForKo(intent, finalized);
  if (finalized) {
    return intent === "storm"
      ? "Thanks! I've flagged this as URGENT storm damage and dispatched it to our on-call crew — expect a call within 15 minutes. 🚨"
      : "Perfect — I've booked you in for a free estimate and sent your details to our scheduling team. You'll hear from us shortly! 📆";
  }
  switch (intent) {
    case "storm":
      return "Oh no — that sounds like storm damage. This is time-sensitive, so let's move fast. Can I grab your name, phone number, and address to dispatch an emergency inspection today?";
    case "commercial":
      return "Got it — a flat/TPO commercial project. Our commercial team handles membrane repair and full re-roofs. What's the approximate square footage, and can I get your contact info for a site visit?";
    case "gutters":
      return "Happy to help with gutters! We install seamless aluminum gutters and leaf guards. Would you like a free measurement? I just need your name and best phone number.";
    case "estimate":
      return "Great — I can set up a free, no-pressure estimate. Is this a repair or a full replacement? And what's the best name and phone number to reach you?";
    case "greeting":
      return `Hi there! I'm Maggie Mae, ${site.name}'s AI receptionist. Are you dealing with storm/leak damage, or looking for a routine roofing estimate?`;
    default:
      return "I can help with that! To point you to the right crew — is this an urgent storm/leak issue, or a routine estimate for shingles, metal, TPO, or gutters?";
  }
}

function replyForEs(intent: Intent, finalized: boolean): string {
  if (finalized) {
    return intent === "storm"
      ? "¡Listo! Marqué esto como daño de tormenta URGENTE y lo mandé a la cuadrilla de guardia — lo llaman en unos 15 minutos. 🚨"
      : "Perfecto — le agendé un presupuesto gratis y ya envié sus datos al equipo. ¡Lo contactamos muy pronto! 📆";
  }
  switch (intent) {
    case "storm":
      return "Uy, eso suena a daño por tormenta, y es urgente. ¿Me da su nombre, su teléfono y la dirección para mandar una inspección de emergencia hoy mismo?";
    case "commercial":
      return "Entendido — un techo plano o comercial. Nuestro equipo comercial repara membrana y hace reemplazos completos. ¿Cuántos pies cuadrados son, más o menos, y a qué nombre y número los contactamos para una visita?";
    case "gutters":
      return "¡Con gusto le ayudo con las canaletas! Instalamos canaletas de aluminio sin costuras y protectores de hojas. ¿Le agendo una medición gratis? Solo necesito su nombre y su mejor número.";
    case "estimate":
      return "Perfecto — le agendo un presupuesto gratis y sin compromiso. ¿Es una reparación o un reemplazo completo? ¿Y a qué nombre y número lo contactamos?";
    case "greeting":
      return `¡Hola! Soy Maggie Mae, la recepcionista de ${site.name}. ¿Tiene goteras o daño por tormenta, o busca un presupuesto para su techo?`;
    default:
      return "Claro, le ayudo. Para pasarlo con la cuadrilla correcta: ¿es una gotera o daño de tormenta urgente, o un presupuesto de rutina para tejas, metal, TPO o canaletas?";
  }
}

function replyForKo(intent: Intent, finalized: boolean): string {
  if (finalized) {
    return intent === "storm"
      ? "확인했습니다! 긴급 폭풍 피해로 표시하고 대기 중인 작업팀에 바로 전달했어요 — 15분 안에 연락드릴 거예요. 🚨"
      : "좋습니다 — 무료 견적 예약해 드렸고 담당 팀에 정보를 보냈어요. 곧 연락드릴게요! 📆";
  }
  switch (intent) {
    case "storm":
      return "어머, 폭풍 피해 같네요. 급한 일이니 빨리 진행할게요. 오늘 긴급 점검을 보내드릴 수 있게 성함, 전화번호, 주소를 알려 주시겠어요?";
    case "commercial":
      return "알겠습니다 — 평지붕이나 상가 지붕이시군요. 저희 상업용 팀이 멤브레인 수리와 전체 교체를 해요. 대략 몇 평방피트인지, 그리고 현장 방문을 위해 성함과 연락처를 알려 주시겠어요?";
    case "gutters":
      return "거터(물받이) 문제 기꺼이 도와드릴게요! 이음새 없는 알루미늄 거터와 낙엽 방지망을 설치해요. 무료 측정 잡아 드릴까요? 성함과 연락 가능한 번호만 알려 주세요.";
    case "estimate":
      return "좋아요 — 부담 없는 무료 견적 잡아 드릴게요. 수리인가요, 전체 교체인가요? 그리고 연락드릴 성함과 전화번호를 알려 주시겠어요?";
    case "greeting":
      return `안녕하세요! 저는 ${site.name}의 AI 안내원 매기 메이예요. 누수나 폭풍 피해가 있으세요, 아니면 지붕 견적이 필요하세요?`;
    default:
      return "네, 도와드릴게요! 맞는 팀에 연결해 드리려면 — 급한 누수나 폭풍 피해인가요, 아니면 슁글, 메탈, TPO, 거터 같은 일반 견적인가요?";
  }
}
