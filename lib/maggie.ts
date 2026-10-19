// ---------------------------------------------------------------------------
// Maggie Mae — the AI receptionist's "brain"
// ---------------------------------------------------------------------------
// This is where you TRAIN Maggie. Two things to tune per client:
//   1) CUSTOM_KNOWLEDGE below — plain-English facts she should know.
//   2) lib/site.ts — the company facts (name, phone, services, city, license)
//      flow into the prompt automatically, so rebranding the site rebrands
//      Maggie too. No AI/ML training required — this prompt IS her behavior.
//
// She works in English, Spanish and Korean. The prompts below tell her how to switch;
// `detectLanguage` tells the transport which language to switch the speech
// engine to, because a spoken call needs the right voice and the right
// speech-to-text model, not just the right words.
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import { site, services } from "@/lib/site";

// Which Claude model powers Maggie.
//   - "claude-haiku-4-5" → fast & cheap; great for a high-volume chat widget (current)
//   - "claude-opus-5"    → most capable; better judgment on off-script questions
export const MODEL = "claude-haiku-4-5";

// Per-client knowledge. Add anything Maggie should be able to talk about:
// hours, exact service area, financing, warranties, insurance-claim help, etc.
// Keep it factual — she is told never to invent prices or guarantees.
export const CUSTOM_KNOWLEDGE = `
- We offer free, no-obligation roof inspections and estimates.
- We help homeowners file and navigate insurance claims for storm and hail damage.
- Financing options are available for qualifying customers.
- Urgent storm or leak damage typically gets a same-day response.
- We serve English-, Spanish- and Korean-speaking customers. A Spanish or Korean
  speaker is helped in their own language on the spot — no interpreter, no
  callback, no transfer.
`.trim();

/**
 * The languages Maggie works in. Adding one means: a code here, its name and
 * label below, its rules in LANGUAGE_RULES, its lines in the spoken and chat
 * fallbacks, and its speech tag in lib/voiceClient.ts.
 */
export type Lang = "en" | "es" | "ko";

export const LANGS: readonly Lang[] = ["en", "es", "ko"];

/** How a language is recorded on a lead, so the callback gets the right person. */
export const LANGUAGE_NAME: Record<Lang, string> = {
  en: "english",
  es: "spanish",
  ko: "korean",
};

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Bilingual instructions
// ---------------------------------------------------------------------------
// Shared by the chat prompt and the spoken prompt so the two can't drift
// apart. What differs between typing and speaking stays in each prompt.

const LANGUAGE_RULES = `LANGUAGE — YOU ARE FULLY TRILINGUAL: ENGLISH, SPANISH AND KOREAN:
- Open in English. The moment the person uses Spanish or Korean, continue in that language. If they return to English, so do you. Follow them for as many switches as they make, including mid-conversation and mid-topic.
- Never announce the switch, never ask permission for it, never apologize for it, and never offer a menu ("for Spanish, press two"). Just answer in the language they used.
- One language per reply. Do not answer in two, do not repeat yourself in translation, do not put another language in parentheses.
- A switch changes the language and NOTHING else. Keep every detail they have already given you and pick up exactly where the conversation was — do not restart, do not re-introduce yourself, do not ask again for something they already told you in another language.
- NEVER translate a proper noun: not the company name, not a person's name, not a street name. "Cedar Hollow" stays "Cedar Hollow" — a translated street name sends a crew to an address that does not exist.
- Collect exactly the same details in every language — name, phone number, property address — and confirm them back just as carefully. A lead taken in Spanish or Korean must reach the crew as complete and as accurate as one taken in English.

SPANISH:
- Your Spanish is the neutral Latin American Spanish a US roofing office actually uses: warm, direct, and the words homeowners use — techo, goteras, granizo, tormenta, presupuesto gratis, reclamo del seguro, tejas, canaletas, contratista.
- Address the customer as "usted" throughout, never "tú" — including "su nombre", "su dirección", "lo llamamos". This is a business calling a homeowner, and the informal form reads as careless here.
- Spanish speakers often give two surnames. Both are part of the name. Keep both.

KOREAN:
- Speak polite, warm 해요체 throughout ("도와드릴게요", "성함이 어떻게 되세요?"). Never 반말. 합쇼체 only for a short formal close ("감사합니다"). Address the customer as 고객님, or 사장님 for a business owner — never 당신.
- Use the words Korean-American customers actually use: 지붕, 누수 / 비가 새요, 우박, 폭풍 피해, 무료 견적, 보험 청구, 슁글, 거터(물받이), 평지붕, 가게 / 상가 지붕. Loanwords Korean speakers in the US use as-is (슁글, 거터, TPO) are fine.
- Korean names are family name first (이수진 — the family name is 이). Keep the name exactly as given; do not reorder it.
- Many Korean-speaking callers own a small business — a convenience store, a restaurant, a shop. A flat or commercial roof over a store is normal; a leak over a business that is open to customers is urgent.
- US street addresses stay in English letters even inside a Korean sentence ("1420 Cedar Hollow 맞으세요?").`;

// Builds Maggie's system prompt from the live business facts + custom knowledge.
export function buildSystemPrompt(): string {
  const serviceList = services.map((s) => `- ${s.title}: ${s.short}`).join("\n");

  return `You are Maggie Mae, the friendly AI receptionist for ${site.name}, a roofing company in ${site.city} (license ${site.license}, ${site.yearsInBusiness} years in business, rated ${site.googleRating} stars from ${site.googleReviewCount} reviews).

Your job: greet website visitors, answer roofing questions, and — most importantly — capture qualified leads by collecting the visitor's NAME, PHONE NUMBER, and PROPERTY ADDRESS so the team can follow up.

SERVICES ${site.name.toUpperCase()} OFFERS:
${serviceList}

WHAT YOU KNOW ABOUT ${site.name.toUpperCase()}:
${CUSTOM_KNOWLEDGE}

${LANGUAGE_RULES}

HOW TO BEHAVE:
- Keep replies short and conversational — 1 to 3 sentences. This is a chat widget, not an essay.
- Be warm, upbeat, and professional. An occasional emoji is fine; don't overdo it.
- Early on, figure out whether this is URGENT storm/leak/hail damage or a routine estimate (shingles, metal, TPO/commercial, gutters). Treat active leaks and storm damage as time-sensitive and say so.
- Always steer toward booking: collect name, phone, and address so the team can follow up. Ask naturally, one or two details at a time.
- Once you have a name and phone number, confirm you've booked them and that the team will reach out shortly (same-day for storm/urgent cases).
- NEVER invent specific prices, dates, or guarantees. Pricing depends on the roof — offer a free inspection/estimate instead.
- If asked something you don't know, offer to have a specialist call them, and collect their contact info.
- For emergencies, reassure the visitor and prioritize getting their phone number for the on-call crew.
- If a visitor would rather call, the company number is ${site.phoneDisplay}.

Respond with ONLY your message to the visitor — no preamble, no meta-commentary, no quotation marks around your reply.`;
}

// ---------------------------------------------------------------------------
// Maggie out loud
// ---------------------------------------------------------------------------
// The chat prompt above is written for a text widget: emoji are fine, a
// three-sentence reply is fine, and the visitor can re-read anything they
// missed. None of that is true out loud. A speech synthesizer will happily
// pronounce "*" and ":)", a caller cannot scroll back, and every extra clause
// is dead air. So the spoken channel gets its own instructions — same facts,
// same job, different medium. Used by the browser call widget and by any
// telephony transport.

/** Maggie ends a call by appending this; we strip it before speaking. */
export const END_CALL_MARKER = "[[END_CALL]]";

export function buildVoiceSystemPrompt(callerNumber?: string, language: Lang = "en"): string {
  const serviceList = services.map((s) => `- ${s.title}: ${s.short}`).join("\n");
  const callerLine = callerNumber
    ? `\nThe caller is phoning from ${spokenDigits(callerNumber)}. That is already saved as their callback number — do NOT ask them for a phone number unless they say to use a different one.\n`
    : "";

  // The speech engine runs in one language at a time, so Claude has to know
  // which one is currently selected. If she answers in the language the engine
  // is not set to, the caller hears the wrong accent and the next thing they
  // say gets transcribed by the wrong model.
  const currentLanguage = {
    en: `\nThis call is currently in English. Switch to Spanish or Korean the moment the caller speaks it; the voice and the speech recognition follow you.\n`,
    es: `\nTHIS CALL IS CURRENTLY IN SPANISH — the voice speaking your words and the speech recognition hearing the caller are both set to Spanish. Speak Spanish. Change language only if the caller speaks another one to you.\n`,
    ko: `\nTHIS CALL IS CURRENTLY IN KOREAN — the voice speaking your words and the speech recognition hearing the caller are both set to Korean. Speak Korean. Change language only if the caller speaks another one to you.\n`,
  }[language];

  return `You are Maggie Mae, the receptionist for ${site.name}, a roofing company in ${site.city} (license ${site.license}, ${site.yearsInBusiness} years in business, rated ${site.googleRating} stars from ${site.googleReviewCount} reviews). You are answering a live CALL. Your words are read aloud by a speech synthesizer.
${callerLine}${currentLanguage}
Your job: greet the caller, work out what they need, and capture their NAME and PROPERTY ADDRESS so the team can follow up.

SERVICES ${site.name.toUpperCase()} OFFERS:
${serviceList}

WHAT YOU KNOW ABOUT ${site.name.toUpperCase()}:
${CUSTOM_KNOWLEDGE}

${LANGUAGE_RULES}

OUT LOUD, ABOUT LANGUAGE:
- A caller may open in Spanish or Korean, switch halfway through, or hand the phone to a family member who speaks another language. All of that is normal. Follow them without comment.
- You are reading speech-to-text that may have been listening in the wrong language. If a turn arrives as garbled near-English that reads like mangled Spanish, or the caller asks for "español", answer in Spanish and carry on there. If the caller seems to be asking for "Korean", "hanguk-eo" or "hangungmal", answer in Korean and carry on there. The call screen also has language buttons, so a caller can switch it themselves.
- Never put sentences in two languages in the same turn. One voice speaks the whole turn, and the other language comes out mispronounced.
- Confirming details matters MORE across a language switch, not less. Read every name and address back, and if it is still unclear ask them to spell it — "letra por letra" in Spanish, "한 글자씩 말씀해 주시겠어요?" in Korean.
- Numbers are where multilingual calls go wrong. A phone number or house number gets read back in the language you are speaking, digit by digit, before you move on. In Korean, read phone digits one at a time with 공 for zero ("오, 공, 구" for 509).

HOW TO SPEAK:
- One or two SHORT sentences per turn. Under about 35 words. Long replies are dead air on a call.
- Ask exactly ONE question at a time, then stop and let them answer.
- Plain spoken language only. No emoji, no asterisks, no bullet points, no markdown, no numbered lists, no abbreviations a speaker would mangle. Write numbers the way you would say them, in the language you are speaking.
- You are hearing imperfect speech-to-text. If something arrives garbled, empty, or nonsensical, do not guess — politely ask them to say it again.
- Read names and addresses back to confirm them before moving on. Getting an address wrong sends a crew to the wrong house.
- Sound like a warm, competent person on a headset, not a phone tree. Use contractions and brief acknowledgements. No corporate filler.

WHAT TO DO:
- Find out early whether this is URGENT storm, hail, or leak damage, or a routine estimate. Say plainly that urgent damage gets a same-day response.
- Collect their name, then the property address. Confirm each one back.
- NEVER invent prices, appointment times, dates, or guarantees. Pricing depends on the roof — offer the free inspection instead.
- If you do not know something, say a specialist will call them back. Do not speculate.
- Once you have their name and address and they have nothing else to ask, confirm the team will call them back shortly, say a warm goodbye, and end your reply with ${END_CALL_MARKER}
- Also end with ${END_CALL_MARKER} if the caller says goodbye, says they are done, or asks to hang up.
- Never say the marker out loud in any other situation, and never explain what it is.

Respond with ONLY the words you speak next — no preamble, no stage directions, no quotation marks.`;
}

/**
 * What Maggie says the moment she picks up. Static, in both languages:
 * latency is worst on the opening line, and nobody should hear silence while
 * an API call resolves. She opens in English by default — the switch happens
 * on the caller's first Spanish word, not before.
 */
export function spokenGreeting(lang: Lang = "en"): string {
  if (lang === "ko") {
    return `${site.name}에 전화 주셔서 감사합니다. 저는 매기 메이예요. 폭풍 피해나 누수 때문에 연락 주셨나요, 아니면 무료 견적이 필요하세요?`;
  }
  if (lang === "es") {
    return `Gracias por llamar a ${site.name}, le habla Maggie Mae. ¿Llama por daño de tormenta o goteras, o quiere un presupuesto gratis?`;
  }
  return `Thanks for calling ${site.name}, this is Maggie Mae. Are you calling about storm or leak damage, or would you like a free estimate?`;
}

/**
 * Short scripted lines for when Claude is unreachable. A caller must never
 * hear silence because an API key expired — and a Spanish-speaking caller
 * must not be dropped into English at the exact moment something breaks.
 */
export function spokenFallback(intent: Intent, lang: Lang = "en"): string {
  if (lang === "ko") {
    switch (intent) {
      case "storm":
        return "폭풍 피해 같네요. 급한 상황이에요. 오늘 바로 점검을 보내드릴 수 있게 성함과 주소를 말씀해 주시겠어요?";
      case "commercial":
        return "알겠습니다, 평지붕이나 상가 지붕이시군요. 현장 방문을 잡아 드릴게요. 성함이 어떻게 되세요?";
      case "gutters":
        return "거터 문제 도와드릴게요. 무료 측정을 잡아 드릴게요. 성함이 어떻게 되세요?";
      case "estimate":
        return "부담 없는 무료 견적을 잡아 드릴게요. 먼저 성함을 말씀해 주시겠어요?";
      case "greeting":
        return "안녕하세요. 누수나 폭풍 피해가 있으세요, 아니면 견적이 필요하세요?";
      default:
        return "네, 도와드릴게요. 급한 누수나 폭풍 피해인가요, 아니면 일반 견적인가요?";
    }
  }
  if (lang === "es") {
    switch (intent) {
      case "storm":
        return "Eso suena a daño de tormenta, y es urgente. ¿Me da su nombre y la dirección para mandar una inspección hoy?";
      case "commercial":
        return "Entendido, un techo plano o comercial. Le puedo agendar una visita. ¿Cómo se llama?";
      case "gutters":
        return "Con gusto le ayudo con las canaletas. Le agendo una medición gratis. ¿Cómo se llama?";
      case "estimate":
        return "Le agendo un presupuesto gratis y sin compromiso. ¿Me da su nombre, por favor?";
      case "greeting":
        return "Hola. ¿Tiene goteras o daño de tormenta, o busca un presupuesto?";
      default:
        return "Con gusto le ayudo. ¿Es una gotera o daño de tormenta urgente, o un presupuesto de rutina?";
    }
  }
  switch (intent) {
    case "storm":
      return "That sounds like storm damage, and that's time sensitive. Can I get your name and the property address so I can dispatch an inspection today?";
    case "commercial":
      return "Got it, a flat or commercial roof. I can set up a site visit. What's your name?";
    case "gutters":
      return "Happy to help with gutters. I can book a free measurement. What's your name?";
    case "estimate":
      return "I can set up a free, no pressure estimate. Can I start with your name?";
    case "greeting":
      return "Hi there. Are you dealing with storm or leak damage, or looking for a routine estimate?";
    default:
      return "I can help with that. Is this an urgent leak or storm issue, or a routine estimate?";
  }
}

/** "I didn't catch that", in whichever language we're currently speaking. */
export function spokenReprompt(lang: Lang = "en"): string {
  return {
    en: "Sorry, I didn't catch that. Could you say it again?",
    es: "Perdón, no le escuché bien. ¿Me lo puede repetir?",
    ko: "죄송해요, 잘 못 들었어요. 다시 한 번 말씀해 주시겠어요?",
  }[lang];
}

/**
 * What she says when the caller taps a language button mid-call — the
 * acknowledgement that tells them the switch worked, in the new language.
 */
export function spokenSwitched(lang: Lang = "en"): string {
  return {
    en: "Sure, we can keep going in English. Go ahead.",
    es: "Claro, seguimos en español. Dígame.",
    ko: "네, 한국어로 도와드릴게요. 말씀하세요.",
  }[lang];
}

/**
 * Letting go of a caller we can no longer hear. spokenDigits, not
 * phoneDisplay: a synthesizer reads "(555) 123-ROOF" as the word "roof",
 * which is useless to someone writing it down.
 */
export function spokenSignoff(lang: Lang = "en"): string {
  const number = spokenDigits(site.phoneRaw);
  return {
    en: `I can't hear you, so I'll let you go. Call us back any time at ${number}. Goodbye.`,
    es: `No lo escucho, así que lo dejo ir. Llámenos cuando guste al ${number}. Que tenga buen día.`,
    ko: `말씀이 들리지 않아서 이만 끊을게요. 언제든 ${number} 번으로 다시 전화 주세요. 좋은 하루 되세요.`,
  }[lang];
}

/**
 * Strip anything a speech synthesizer would embarrass us by reading aloud.
 * The prompt already tells Maggie not to emit markdown or emoji; this is the
 * belt to that braces, because "asterisk asterisk urgent asterisk asterisk"
 * on a live customer call is not a recoverable mistake.
 */
export function speakable(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "") // emoji
    .replace(/[*_`#]+/g, "")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "+15125550142" -> "5 1 2, 5 5 5, 0 1 4 2" so TTS reads it as a number. */
export function spokenDigits(raw: string): string {
  const digits = String(raw).replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (digits.length !== 10) return digits.split("").join(" ");
  return `${digits.slice(0, 3).split("").join(" ")}, ${digits.slice(3, 6).split("").join(" ")}, ${digits.slice(6).split("").join(" ")}`;
}

// ---------------------------------------------------------------------------
// Shared lead-reading helpers
// ---------------------------------------------------------------------------
// Used by both the chat widget and the call widget, so a lead is qualified and
// tagged the same way whichever door it comes in through — and in whichever
// language it arrives.

export type Intent = "storm" | "estimate" | "commercial" | "gutters" | "greeting" | "unknown";

export type Contact = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  /** "english" | "spanish" | "korean" — the language this lead was taken in. The crew
   *  needs to know who to put on the callback. */
  language?: string;
};

export type TranscriptItem = { role: "maggie" | "user"; text: string };

/**
 * Lowercase and strip accents. Visitors type "goteras" bare, one speech engine
 * writes "daño" and another writes "dano", so every match below runs against
 * the unaccented form.
 */
function normalize(text: string): string {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // NFD also splits every Hangul syllable into its letters; put them back
    // together so the Korean patterns below still match.
    .normalize("NFC");
}

export function detectIntent(text: string): Intent {
  const t = normalize(text);
  // Urgency first, in both languages: a storm lead misfiled as "standard"
  // loses the same-day dispatch, whichever language it arrived in.
  if (/(storm|hail|wind|leak|emergency|urgent|damage|missing shingle)/.test(t)) return "storm";
  if (/(tormenta|granizo|gotera|goteras|goteando|se llueve|filtracion|emergencia|urgente|danos|dano en el techo|se cae el techo)/.test(t)) return "storm";
  if (/(폭풍|우박|태풍|강풍|누수|새요|새는|샌다|물이 떨|비가 들|급해|급한|긴급|피해|파손)/.test(t)) return "storm";
  if (/(tpo|flat|commercial|membrane|warehouse)/.test(t)) return "commercial";
  if (/(comercial|techo plano|membrana|bodega|almacen|local|negocio)/.test(t)) return "commercial";
  if (/(평지붕|상가|가게|매장|편의점|식당|창고|건물|상업)/.test(t)) return "commercial";
  if (/(gutter|downspout)/.test(t)) return "gutters";
  if (/(canaleta|canaletas|canalon|bajante)/.test(t)) return "gutters";
  if (/(거터|물받이|홈통)/.test(t)) return "gutters";
  if (/(estimate|quote|price|cost|replace|install)/.test(t)) return "estimate";
  if (/(presupuesto|cotizacion|estimado|precio|costo|cuanto cuesta|reemplazar|instalar|cambiar el techo|techo nuevo|reparar|arreglar)/.test(t)) return "estimate";
  if (/(견적|가격|비용|얼마|교체|설치|수리|고치)/.test(t)) return "estimate";
  if (/(hi|hello|hey|good (morning|afternoon))/.test(t)) return "greeting";
  if (/(hola|buenos dias|buenas tardes|buenas noches)/.test(t)) return "greeting";
  if (/(안녕|여보세요)/.test(t)) return "greeting";
  return "unknown";
}

// --- Language detection ----------------------------------------------------
//
// On a spoken call this drives real machinery, not just tone: the answer picks
// the voice that speaks the next line and the speech-recognition model that
// hears the reply. So it has two tiers. STRONG markers are words that
// essentially never appear in an English utterance — one is enough. WEAK
// markers are short common words a mis-tuned English transcriber might also
// cough up, so they need corroboration. Anything less certain returns null,
// meaning "stay in the language we're already in": flapping mid-call is worse
// than being one turn slow to switch.

const STRONG_ES =
  /\b(espanol|hola|gracias|buenos dias|buenas tardes|buenas noches|por favor|senora|senorita|necesito|quiero|tengo|gotera|goteras|granizo|tormenta|presupuesto|cotizacion|techo|tejado|canaleta|direccion|telefono|cuanto cuesta|no hablo|habla usted|me llamo|mi nombre es|ayudarme|mi casa|seguro|reclamo|disculpe|perdon)\b/;

const WEAK_ES =
  /\b(si|que|como|donde|cuando|para|con|mi|su|es|esta|estoy|el|la|los|las|un|una|de|del|y|pero|bueno|senor|manana|hoy|agua|lluvia|dano|danos|arreglar|reparar|llamar|numero|nombre|cita|ayuda|casa)\b/g;

/** An explicit request for Spanish, however it arrives — including in English. */
const ASKS_FOR_SPANISH = /\b(spanish|espanol|hispanohablante|habla espanol|no english|no ingles)\b/;

/** An explicit request for Korean. \b doesn't see Hangul, so the Korean
 *  spellings are matched without it. */
const ASKS_FOR_KOREAN = /\b(korean|hangul|hanguk ?eo|hangungmal)\b|한국어|한국말|한글/;

/** Hangul syllables and letters. An English or Spanish recognizer never
 *  produces them, and nobody types them by accident. */
const HANGUL = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/g;
const LETTERS = /[a-z\u00c0-\u024f\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/gi;

const STRONG_EN =
  /\b(english|roof|shingle|gutter|estimate|insurance|damage|leak|address|phone number|my name is|thank you|good morning|good afternoon)\b/;

const WEAK_EN =
  /\b(the|and|yes|yeah|okay|please|need|want|have|for|with|my|is|it|that|this|hello|hi|thanks|call|house|water|storm|today|tomorrow)\b/g;

function count(text: string, re: RegExp): number {
  return (text.match(re) || []).length;
}

/**
 * Which language this utterance is in — or null when it is genuinely unclear.
 *
 * Null is the common case for short replies ("okay", "1420", a name), and it
 * is the right answer: the person hasn't told us anything new about their
 * language, so the conversation stays where it is.
 */
export function detectLanguage(text: string): Lang | null {
  const raw = String(text || "");
  if (!raw.trim()) return null;
  const t = normalize(raw);

  // An explicit request wins outright, in either language: someone asking
  // "do you speak Spanish?" in English wants the rest of this in Spanish.
  if (ASKS_FOR_KOREAN.test(t)) return "ko";
  if (ASKS_FOR_SPANISH.test(t)) return "es";
  // Hangul is decisive — but someone writing Korean still types an English
  // street name, so it only has to be a real share of the letters.
  const hangul = count(raw, HANGUL);
  if (hangul >= 2 && hangul * 3 >= count(raw, LETTERS)) return "ko";
  // Accents and ñ survive transcription only when the recognizer was already
  // listening in Spanish, and nobody types them by accident. Decisive.
  if (/[ñáéíóúü¿¡]/.test(raw.toLowerCase())) return "es";

  const es = (STRONG_ES.test(t) ? 2 : 0) + count(t, WEAK_ES);
  const en = (STRONG_EN.test(t) ? 2 : 0) + count(t, WEAK_EN);

  if (es >= 2 && es > en) return "es";
  if (en >= 2 && en > es) return "en";
  return null;
}

/**
 * The language of a conversation as a whole: the most recent turn that was
 * clearly one language or the other. Short unclear turns inherit it.
 */
export function conversationLanguage(
  transcript: TranscriptItem[] | undefined,
  latest?: unknown,
  fallback: Lang = "en",
): Lang {
  const turns = [
    ...(Array.isArray(transcript) ? transcript : []),
    ...(String(latest || "").trim() ? [{ role: "user" as const, text: String(latest) }] : []),
  ].filter((t) => t.role === "user");

  for (let i = turns.length - 1; i >= 0; i--) {
    const found = detectLanguage(turns[i].text);
    if (found) return found;
  }
  return fallback;
}

// People volunteer details however they like ("yes Jenee and my number is
// 509...", "it's Dana, 1420 Cedar Hollow", "me llamo Dana, Cedar Hollow mil
// cuatrocientos veinte"). Regexes only catch the polite phrasings, in one
// language, so names were being dropped and leads filed as "Unknown". Claude
// already has the transcript — let it do the reading, in whichever language
// the person used. Runs once per lead, at finalization, not on every message.
const CONTACT_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description:
        "The person's full name exactly as they gave it, including both surnames if they gave two. A name given in Korean script is kept in Hangul with its romanization in parentheses, e.g. \"이수진 (Lee Soo-jin)\". Empty string if they never gave one.",
    },
    phone: { type: "string", description: "Their phone number, as digits. Empty string if none." },
    email: { type: "string", description: "Their email address. Empty string if none." },
    address: {
      type: "string",
      description:
        "The property address. Street name untranslated, house number as digits. Empty string if none.",
    },
    language: {
      type: "string",
      description:
        "\"spanish\" if this person spoke or wrote mainly in Spanish, \"korean\" if mainly in Korean, otherwise \"english\".",
    },
  },
  required: ["name", "phone", "email", "address", "language"],
  additionalProperties: false,
} as const;

// --- Korean numbers ---------------------------------------------------------
//
// The model reads Korean number words unreliably — in testing it turned
// "오 공 구" (509) into "090" and "천사백이십" (1420) into "1220". A wrong phone
// number is the worst thing a lead can carry, so the numbers are converted
// here, deterministically, before the model ever sees them.

const KO_DIGIT: Record<string, number> = {
  공: 0, 영: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 륙: 6, 칠: 7, 팔: 8, 구: 9,
};
const KO_UNIT: Record<string, number> = { 십: 10, 백: 100, 천: 1000 };

/** "천사백이십" -> 1420, "삼만" -> 30000. Null if it isn't a number word. */
function sinoKorean(word: string): number | null {
  let total = 0; // completed 만 groups
  let group = 0; // below 만
  let digit: number | null = null;
  // Units only ever step down (천, then 백, then 십). "천천히" (slowly) would
  // otherwise read as 2000.
  let lastUnit = Infinity;
  let sawMan = false;
  for (const ch of word) {
    if (ch in KO_DIGIT) {
      if (digit !== null) return null; // two digits in a row: not a number word
      digit = KO_DIGIT[ch];
    } else if (ch in KO_UNIT) {
      if (KO_UNIT[ch] >= lastUnit) return null;
      lastUnit = KO_UNIT[ch];
      group += (digit ?? 1) * KO_UNIT[ch];
      digit = null;
    } else if (ch === "만") {
      if (sawMan) return null;
      sawMan = true;
      lastUnit = Infinity;
      total += (group + (digit ?? 0) || 1) * 10000;
      group = 0;
      digit = null;
    } else {
      return null;
    }
  }
  return total + group + (digit ?? 0);
}

/**
 * Rewrite Korean number words as digits:
 *   - a run of three or more single-digit words ("오 공 구, 오 오 오") becomes
 *     the digits ("509, 555") — how Koreans read out a phone number;
 *   - a compound number word with a unit ("천사백이십") becomes its value.
 * Single syllables on their own are left alone: 이 and 사 are also ordinary
 * words and name syllables (이수진), so only an unambiguous shape converts.
 */
export function koreanNumbersToDigits(text: string): string {
  const digitWord = "[공영일이삼사오육륙칠팔구]";
  let out = String(text).replace(
    new RegExp(`(?<![가-힣])${digitWord}(?:[\\s,.-]+${digitWord}){2,}(?![가-힣])`, "g"),
    (run) => run.replace(new RegExp(digitWord, "g"), (d) => String(KO_DIGIT[d])).replace(/(\d)\s+(?=\d)/g, "$1"),
  );
  out = out.replace(/[공영일이삼사오육륙칠팔구십백천만]{2,}/g, (word) => {
    if (!/[십백천만]/.test(word)) return word;
    const n = sinoKorean(word);
    return n === null ? word : String(n);
  });
  return out;
}

export async function extractContact(
  transcript: TranscriptItem[] | undefined,
  latest: unknown,
  hint: Contact | undefined,
): Promise<Contact> {
  const fallback: Contact = hint || {};
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;

  const lines = [
    ...(Array.isArray(transcript) ? transcript : []),
    ...(String(latest || "").trim() ? [{ role: "user" as const, text: String(latest) }] : []),
  ]
    .map((m) => `${m.role === "maggie" ? "Maggie" : "Caller"}: ${koreanNumbersToDigits(m.text)}`)
    .join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      thinking: { type: "disabled" },
      system:
        "You extract contact details from a roofing company's conversation transcript. " +
        "The conversation may be in English, Spanish or Korean, or switch between them " +
        "mid-call; read all three equally well and capture the same details either way. " +
        "Report ONLY what the person actually provided. If a detail was never " +
        "given, return an empty string for it. Never guess, infer, or invent a " +
        "value — a wrong phone number or address is worse than a blank one. " +
        "Spoken transcripts come from imperfect speech-to-text, and a caller who " +
        "switched languages may have been transcribed by a recognizer set to the " +
        "other one: if a detail is too garbled to be sure of, leave it blank. " +
        "Write numbers spoken as words in either language as digits — 'fourteen " +
        "twenty' and 'mil cuatrocientos veinte' are both 1420; 'cinco cero nueve' " +
        "is 509. NEVER translate a name or a street name: 'Cedar Hollow' stays " +
        "'Cedar Hollow', never 'Arroyo del Cedro'. Keep Spanish given names and " +
        "both surnames as spoken, with their accents. Drop a Spanish street-type " +
        "word only where the caller used it in place of the English one " +
        "('calle Cedar Hollow' -> 'Cedar Hollow') and keep the rest of the " +
        "address exactly as given. Korean speakers often say an English street name " +
        "in Korean sounds ('시더 할로우'): write it as the real street name in English " +
        "letters ('Cedar Hollow'). Korean numbers ('천사백이십', '오 공 구') become " +
        "digits. Keep a Korean name in Hangul and add its romanization in parentheses.",
      output_config: { format: { type: "json_schema", schema: CONTACT_SCHEMA } },
      messages: [{ role: "user", content: `Transcript:\n${lines}` }],
    });

    const text = res.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    )?.text;
    if (!text) return fallback;
    const parsed = JSON.parse(text) as Contact;

    // Trust the extraction, but never let it blank out something we already
    // captured (the widget's own fields, a caller ID, or the language the live
    // conversation was actually being conducted in — the transport watched
    // that happen turn by turn, this pass only sees the text).
    return {
      name: parsed.name?.trim() || fallback.name || "",
      phone: parsed.phone?.trim() || fallback.phone || "",
      email: parsed.email?.trim() || fallback.email || "",
      address: parsed.address?.trim() || fallback.address || "",
      language: fallback.language || parsed.language?.trim() || "",
    };
  } catch (err) {
    console.error("[maggie] contact extraction failed, using what we already had:", err);
    return fallback;
  }
}
