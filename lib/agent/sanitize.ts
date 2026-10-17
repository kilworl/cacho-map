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

const sentences = (t: string) => t.split(/(?<=[.!?…])\s+/).filter(Boolean);
const capFirst = (t: string) => t.charAt(0).toLocaleUpperCase() + t.slice(1);

/** Removes sentences that cite any percentage other than the overall one, or banned words. */
export function cleanLine(text: string, pct: number): string {
  // Split on real sentence ends only, so "final feliz… para él" stays one sentence and is dropped whole.
  const kept = fixPunctuation(text.normalize("NFC")).split(/(?<=[.!?])\s+/).filter(Boolean).filter((s) => {
    if (FORBIDDEN.test(s) || DARK.test(s) || SEXUAL.test(s)) return false;
    const nums = [...s.matchAll(/(\d{1,3})\s?%/g)].map((m) => Number(m[1]));
    return nums.every((n) => n === pct);
  });
  return fixPunctuation(capFirst(kept.join(" ").replace(LEADING_SLANG, (_m, pre: string, ch: string) => pre + ch.toLocaleUpperCase()).replace(TRAILING_SLANG, ".").replace(/[.…]\.+$/, ".").replace(CORNY_OPENER, "").replace(/¡/g, "").replace(/!+/g, ".")));
}

/** Enforces the output contract on whatever the LLM produced. */
export function sanitizeRoast(r: Roast, pct: number, lang: Lang, worstZone?: string): Roast {
  const label = pctLabel(pct, lang);
  let title = fixPunctuation(r.title.normalize("NFC").replace(/[!¡]/g, "")).replace(/(\s*·\s*)+$/, "").replace(/[.…]+$/, "");
  if (DARK.test(title) || SEXUAL.test(title)) title = worstZone ? `${label} · ${worstZone}` : label;
  if (FORBIDDEN.test(title) || !title.startsWith(label) || /\d+\s?%.*\d+\s?%/.test(title)) {
    const tail = title.includes("·") ? title.split("·").slice(1).join("·").replace(/\d+\s?%/g, "").trim() : "";
    title = tail ? `${label} · ${tail}` : worstZone ? `${label} · ${worstZone}` : label;
  }
  return { title, roast: cleanLine(r.roast, pct), plan: cleanLine(r.plan, pct) };
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
