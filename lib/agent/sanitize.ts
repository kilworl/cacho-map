import type { Lang, Roast } from "../types";
import { pctLabel } from "./prompt";

const FORBIDDEN = /probabilidad|posibilidad|probabilit|likelihood|\bodds\b|resto de la ciudad/i;
/** Dark or violent imagery is never funny here: drop the sentence. */
export const DARK = /ventana|suicid|\bmat(a|ar|ó|aría)\b|muert|morir|muere|sangr|golpe|puñal|cuchill|\barmas?\b|pistola|\bkill|\bdies?\b|\bdead\b|murder|blood|jump(s|ing)? out|window|stab|gun\b|veneno|poison/i;
const CORNY_OPENER = /^\s*(¡\s*)?(ay+|oye|vaya|bueno|uy|wow|oh|well)\b[,!.\s]*/i;

/** Slang tacked on as a lone word at the end ("…, eche.") reads forced; drop it. */
const SLANG = "(?:eche|ajá|aja|qué nota|que nota|no joda)";
const TRAILING_SLANG = new RegExp(`(?:(?<=\\p{L})[,;]|(?<=[.?]))\\s*(?:${SLANG}[,\\s]*)+\\.?\\s*$`, "iu");

/** Slang used as a filler opener ("Eche, no son…") also reads forced. */
const LEADING_SLANG = new RegExp(`(^|[.?]\\s+)${SLANG},\\s*(\\p{L})`, "giu");

const sentences = (t: string) => t.split(/(?<=[.!?…])\s+/).filter(Boolean);
const capFirst = (t: string) => t.charAt(0).toLocaleUpperCase() + t.slice(1);

/** Removes sentences that cite any percentage other than the overall one, or banned words. */
export function cleanLine(text: string, pct: number): string {
  const kept = sentences(text.normalize("NFC").trim()).filter((s) => {
    if (FORBIDDEN.test(s) || DARK.test(s)) return false;
    const nums = [...s.matchAll(/(\d{1,3})\s?%/g)].map((m) => Number(m[1]));
    return nums.every((n) => n === pct);
  });
  return capFirst(kept.join(" ").replace(LEADING_SLANG, (_m, pre: string, ch: string) => pre + ch.toLocaleUpperCase()).replace(TRAILING_SLANG, ".").replace(/\.\.+$/, ".").replace(CORNY_OPENER, "").replace(/¡/g, "").replace(/!+/g, ".").replace(/\.\./g, ".").trim());
}

/** Enforces the output contract on whatever the LLM produced. */
export function sanitizeRoast(r: Roast, pct: number, lang: Lang, worstZone?: string): Roast {
  const label = pctLabel(pct, lang);
  let title = r.title.normalize("NFC").replace(/[!¡]/g, "").replace(/\s+/g, " ").trim();
  if (FORBIDDEN.test(title) || !title.startsWith(label) || /\d+\s?%.*\d+\s?%/.test(title)) {
    const tail = title.includes("·") ? title.split("·").slice(1).join("·").replace(/\d+\s?%/g, "").trim() : "";
    title = tail ? `${label} · ${tail}` : worstZone ? `${label} · ${worstZone}` : label;
  }
  return { title, roast: cleanLine(r.roast, pct), plan: cleanLine(r.plan, pct) };
}
