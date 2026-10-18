import type { Lang, Roast } from "../types";
import { pctLabel } from "./prompt";

const FORBIDDEN = /probabilidad|posibilidad|probabilit|likelihood|\bodds\b|resto de la ciudad/i;
/** Dark or violent imagery is never funny here: drop the sentence. */
export const DARK = /ventana|suicid|\bmat(a|ar|ó|aría)\b|muert|morir|muere|sangr|golpe|puñal|cuchill|\barmas?\b|pistola|\bkill|\bdies?\b|\bdead\b|murder|blood|jump(s|ing)? out|window|stab|gun\b|veneno|poison/i;
/** Sexual innuendo: never, not even as a wink. */
export const SEXUAL = /final feliz|happy ending|\bsex|sexy|\bcama\b|\bbed\b|desnud|naked|\bnude|orgasm|\bpolvo\b|calentura|\bcachond|\bhorny|kinky|\bmotel|\bintim|íntim|\bbesuque|\bmanose|\bse (la|lo) com(e|ió|ería)\b|\bhook ?up|one[- ]night|\b69\b|\btirar(se|le)?\b|\bpicante|\bspicy\b|\bmorbo|\bperv/i;
const CORNY_OPENER = /^\s*(¡\s*)?(ay+|oye|vaya|bueno|uy|wow|oh|well)\b[,!.\s]*/i;

/** Slang tacked on as a lone word at the end ("…, eche.") reads forced; drop it. */
const SLANG = "(?:eche|ajá|aja|qué nota|que nota|no joda)";
const TRAILING_SLANG = new RegExp(`(?:(?<=\\p{L})[,;]|(?<=[.?]))\\s*(?:${SLANG}[,\\s]*)+\\.?\\s*$`, "iu");

/** Slang used as a filler opener ("Eche, no son…") also reads forced. */
const LEADING_SLANG = new RegExp(`(^|[.?]\\s+)${SLANG},\\s*(\\p{L})`, "giu");

/** Punctuation cleanup: ".." / "..." → "…", no space before punctuation, one space after, single spaces. */
export function fixPunctuation(t: string): string {
  return t
    .replace(/\.{2,}/g, "…")
    .replace(/…\.+/g, "…")
    .replace(/\s+([,.;:!?…)])/g, "$1")
    .replace(/([¿¡(])\s+/g, "$1")
    .replace(/([,;:])(?=[\p{L}“‘])/gu, "$1 ")
    .replace(/([.!?])(?=\p{Lu})/gu, "$1 ")
    .replace(/…(?=[\p{L}])/gu, "… ")
    .replace(/,{2,}/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** "restaurantes restaurantes" -> "restaurantes" (lowercase only, so "Bora Bora" stays). */
export const dedupeWords = (t: string) => t.replace(/(?<![\p{L}])(\p{Ll}{2,})(\s+\1)+(?![\p{L}])/gu, "$1");

/** Words that open a clause where a comma before the verb is fine ("Si llueve, es mejor…"). */
const SUBORD = /(^|\s)(si|cuando|aunque|mientras|porque|como|pero|ya que|apenas|if|when|although|while|because|since|though|as|but)\s/i;
/** "cada salida a X sin Valentina, es un ataque" -> no comma between subject and verb. */
export function fixSubjectComma(t: string): string {
  return t.replace(/(^|[.:;!?…]\s*)([^.:;!?…,]+),\s+(es|son|era|eran|fue|será|sería|is|are|was|were)\b/giu, (m, pre: string, subj: string, verb: string) =>
    SUBORD.test(` ${subj} `) || subj.trim().split(/\s+/).length < 3 ? m : `${pre}${subj} ${verb}`);
}

/** Vibes the data never backs ("romántico", "mágico", "perfect"): removed from plans and descriptions. */
const OVERSTATED: Record<Lang, RegExp> = {
  es: /(,\s*|\s+y\s+|\s+)(muy\s+|super\s+|súper\s+)?(romántic[oa]s?|mágic[oa]s?|perfect[oa]s?|deliciosa?s?|inolvidables?|espectaculares?|increíbles?|ideal(es)?|paradisíac[oa]s?|encantador(a|es|as)?|idílic[oa]s?|tranquil[oa]s?)(?![\p{L}])/giu,
  en: /(,\s*|\s+and\s+|\s+)(very\s+|super\s+)?(romantic|magical|perfect|unforgettable|amazing|delicious|stunning|breathtaking|charming|idyllic|ideal|dreamy|quiet|tranquil)(?![\p{L}])/giu,
};
export function tameAdjectives(t: string, lang: Lang): string {
  let out = t.replace(OVERSTATED[lang], "");
  if (lang === "en") out = out.replace(/\b([Aa])n (?=[b-df-hj-np-tv-z])/g, "$1 ").replace(/\b([Aa]) (?=[aeiou])/g, "$1n ");
  return fixPunctuation(out);
}

const capFirst = (t: string) => t.charAt(0).toLocaleUpperCase() + t.slice(1);

/** Removes sentences that cite any percentage other than the overall one, or banned words. */
export function cleanLine(text: string, pct: number): string {
  // Split on real sentence ends only, so "final feliz… para él" stays one sentence and is dropped whole.
  const kept = fixPunctuation(text.normalize("NFC")).split(/(?<=[.!?])\s+/).filter(Boolean).filter((s) => {
    if (FORBIDDEN.test(s) || DARK.test(s) || SEXUAL.test(s)) return false;
    const nums = [...s.matchAll(/(\d{1,3})\s?%/g)].map((m) => Number(m[1]));
    return nums.every((n) => n === pct);
  });
  return fixPunctuation(capFirst(fixSubjectComma(dedupeWords(kept.join(" "))).replace(LEADING_SLANG, (_m, pre: string, ch: string) => pre + ch.toLocaleUpperCase()).replace(TRAILING_SLANG, ".").replace(/[.…]\.+$/, ".").replace(CORNY_OPENER, "").replace(/¡/g, "").replace(/!+/g, ".")));
}

/** Enforces the output contract on whatever the LLM produced. */
/** Control characters the model sometimes emits ("5% \b · …"). */
export const stripControl = (t: string) => t.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "");

export function sanitizeRoast(r: Roast, pct: number, lang: Lang, worstZone?: string): Roast {
  const label = pctLabel(pct, lang);
  r = { title: stripControl(r.title), roast: stripControl(r.roast), plan: stripControl(r.plan) };
  let title = fixPunctuation(r.title.normalize("NFC").replace(/[!¡]/g, "")).replace(/(\s*·\s*)+$/, "").replace(/[.…]+$/, "");
  if (DARK.test(title) || SEXUAL.test(title)) title = worstZone ? `${label} · ${worstZone}` : label;
  if (FORBIDDEN.test(title) || !title.startsWith(label) || /\d+\s?%.*\d+\s?%/.test(title)) {
    const tail = title.includes("·") ? title.split("·").slice(1).join("·").replace(/\d+\s?%/g, "").trim() : "";
    title = tail ? `${label} · ${tail}` : worstZone ? `${label} · ${worstZone}` : label;
  }
  // No empty segments left over ("Cheating risk: 5% · Case closed · " after a stray % was removed).
  title = title.replace(/(\s*·\s*)+(?=\s*·)/g, "").replace(/(\s*·\s*)+$/, "").trim();
  return { title, roast: cleanLine(r.roast, pct), plan: tameAdjectives(cleanLine(r.plan, pct), lang) };
}

const ES_WORDS = new Set(
  "el la los las que con de y es un una unos unas para no se su sus le les lo del al por como pero muy más mas ya en donde cuando ambos juntos juntas podrían pueden puede van ir hay este esta estos estas eso esto tiene tienen sin sobre entre también tambien hasta desde porque mientras sale salen otra otro cada vez solo sola aquí aqui allá así asi ser son está están fue tarde noche plan planes lugar lugares comer tomar ver disfrutar disfrutan".split(" "),
);
const EN_WORDS = new Set(
  "the and is to of with for her his they it at in on but that this you your our we us my me he she him what who which how all any only also again here than then about after before been try pick if not are be can could would will their them there where when both together while from into out just some each other place places go get have has was were do does an or by so very more enjoy grab watch eat drink".split(" "),
);

/**
 * Rough language check for model output (common function words, plus Spanish-only
 * letters). English text must clearly win; Spanish wins ties (names, "sushi").
 */
export function inLang(text: string, lang: Lang): boolean {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  const es = words.filter((w) => ES_WORDS.has(w)).length + (text.match(/[ñáéíóú¿¡]/gi)?.length ?? 0);
  const en = words.filter((w) => EN_WORDS.has(w)).length;
  // Sentence-length text must show at least one function word of its language.
  const long = words.length >= 4;
  if (lang === "es") return es >= en && (!long || es > 0);
  return en > es || (!long && en === 0 && es === 0);
}

/**
 * A punchline that hedges instead of landing ("maybe he's having sushi, or he's just
 * rolling out"; "o simplemente se fue") is a non-joke: reject it before the judge.
 */
const HEDGE = /(?:^|[\s,;])(?:or|o)\s+(?:maybe\s+|tal vez\s+|quizás?\s+)?(?:(?:he|she|they|it)(?:['’]s|['’]re| is| are)?\s+|(?:él|ella|elle)\s+)?(?:just|simply|simplemente|solo\s+(?:está|se\s+fue))\b/iu;
export const isHedged = (text: string): boolean => HEDGE.test(text);
