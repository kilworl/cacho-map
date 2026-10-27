import type { Lang, Pronoun } from "../types";

export interface Person {
  nick: string;
  pronoun: Pronoun;
}

/** How to describe a person's pronoun inside an LLM prompt. */
export function pronounHint(p: Person, lang: Lang): string {
  if (lang === "es") {
    return p.pronoun === "m" ? `${p.nick} (él: usa masculino)` : p.pronoun === "f" ? `${p.nick} (ella: usa femenino)` : `${p.nick} (neutro: sin adjetivos con género, p. ej. "se iría sin compañía", nunca "solo/sola")`;
  }
  return p.pronoun === "m" ? `${p.nick} (he/him)` : p.pronoun === "f" ? `${p.nick} (she/her)` : `${p.nick} (they/them: use the name or "they")`;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sentences = (t: string) => t.split(/(?<=[.!?…])\s+/).filter(Boolean);

/** Verb + "solo/sola" = "alone" (not the adverb "solo" = only). */
const ALONE = /\b((?:se\s+)?(?:iría|irá|va|iba|vaya|fue|ir|irse|sale|saldría|salió|salir|queda|quedaría|quedó|quedarse|quedar|termina|terminaría|terminó|terminar|anda|andaría|andar|está|estaría|estará|estar|vendría|viene|venir|llega|llegaría|llegar))\s+(solo|sola|solito|solita)\b/giu;
const ES_GENDERED: [RegExp, string, string][] = [
  // masc, fem pairs for common adjectives about a person
  [/\b(enamorad[oa])\b/giu, "enamorado", "enamorada"],
  [/\b(celos[oa])\b/giu, "celoso", "celosa"],
  [/\b(aburrid[oa])\b/giu, "aburrido", "aburrida"],
  [/\b(perdid[oa])\b/giu, "perdido", "perdida"],
  [/\b(experto|experta)\b/giu, "experto", "experta"],
];

/** Name of the person most recently mentioned before `index` in `s`. */
function subjectAt(s: string, index: number, people: Person[]): Person | undefined {
  let best: { p: Person; at: number } | undefined;
  for (const p of people) {
    const re = new RegExp(`\\b${esc(p.nick)}\\b`, "giu");
    for (const m of s.matchAll(re)) if (m.index! < index && (!best || m.index! > best.at)) best = { p, at: m.index! };
  }
  // A pronoun ("ella"/"él") closer to the adjective than any name points to the person who uses it.
  for (const [re, g] of [[/\bella\b/giu, "f"], [/\bél\b/giu, "m"]] as const) {
    const owners = people.filter((p) => p.pronoun === g);
    if (owners.length !== 1) continue;
    for (const m of s.matchAll(re)) if (m.index! < index && (!best || m.index! > best.at)) best = { p: owners[0], at: m.index! };
  }
  return best?.p;
}

/**
 * Fixes or drops sentences whose gendered forms don't match the chosen pronouns.
 * ES: "Caro iría sola" → "sola"/"solo"/"sin compañía" per Caro's pronoun; other gendered
 * adjectives are fixed for él/ella and the sentence is dropped for neutral. Pronouns
 * ("él"/"ella", "he"/"she") nobody uses drop the sentence.
 */
export function fixGender(text: string, people: Person[], lang: Lang): string {
  const has = (g: Pronoun) => people.some((p) => p.pronoun === g);
  const out: string[] = [];
  for (let s of sentences(text)) {
    if (lang === "es") {
      if ((/\bél\b/iu.test(s) && !has("m")) || (/\bella\b/iu.test(s) && !has("f"))) continue;
      s = s.replace(ALONE, (m, verb: string, _adj: string, off: number) => {
        const p = subjectAt(s, off, people);
        if (!p) return m;
        return `${verb} ${p.pronoun === "m" ? "solo" : p.pronoun === "f" ? "sola" : "sin compañía"}`;
      });
      let drop = false;
      for (const [re, masc, fem] of ES_GENDERED) {
        s = s.replace(re, (m, _w: string, off: number) => {
          const p = subjectAt(s, off, people);
          if (!p) return m;
          if (p.pronoun === "n") drop = true;
          return p.pronoun === "m" ? masc : p.pronoun === "f" ? fem : m;
        });
      }
      if (drop) continue;
    } else {
      if ((/\b(he|him|his|himself)\b/i.test(s) && !has("m")) || (/\b(she|her|hers|herself)\b/i.test(s) && !has("f"))) continue;
    }
    out.push(s);
  }
  return out.join(" ").trim();
}

/**
 * When a title/roast says "his/her/their X" and X is a known taste of one person,
 * rewrite it as "Name's X" so the wrong pronoun can't stick (e.g. "Her gym" when Leo owns gym).
 * Spanish "su/sus" is gender-neutral, so this only rewrites English possessives.
 */
export function fixTastePossessives(
  text: string,
  ownership: { nick: string; pronoun: Pronoun; tastes: string[] }[],
  lang: Lang,
): string {
  if (lang !== "en" || !text.trim()) return text;
  const entries = ownership
    .flatMap((p) => p.tastes.filter(Boolean).map((taste) => ({ taste: taste.trim(), nick: p.nick })))
    .filter((e) => e.taste.length >= 2)
    .sort((a, b) => b.taste.length - a.taste.length);
  let out = text;
  for (const { taste, nick } of entries) {
    const re = new RegExp(`\\b(his|her|hers|their)\\s+(${esc(taste)})\\b`, "giu");
    out = out.replace(re, (_m, _poss: string, t: string) => `${nick}'s ${t}`);
  }
  return out;
}
