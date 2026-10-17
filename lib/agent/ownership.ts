import type { TasteEntity } from "../types";

/**
 * Deterministic fact check for jokes:
 *  1. every cited taste must be attributed to the person who actually has it, and
 *  2. no other proper names (songs, albums, characters, coined words) may appear unless
 *     they come from Qloo's data for the couple's tastes, the places, or the city.
 * Jokes can't cite "Motomami" for Karol G, or give Fast & Furious to the wrong person.
 */

export interface OwnerPerson {
  nick: string;
  tastes: TasteEntity[];
  /** Taste names as shown to the model (typed input in ES, Qloo name in EN). */
  shown?: string[];
}

export interface OwnershipCtx {
  a: OwnerPerson;
  b: OwnerPerson;
  /** Place names, zone names, the city: proper names that are always allowed. */
  vocab: string[];
}

export interface CheckResult {
  ok: boolean;
  reason?: string;
}

/** Lowercase, no accents, "&"/"and"/"y" unified, punctuation as spaces. */
export function fold(s: string): string {
  return ` ${s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\b(and|y)\b/g, "&")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/** Ways a taste can be written: Qloo name, short name, what was typed, alternate titles. */
export function aliases(e: TasteEntity, shown: string[] = []): string[] {
  const base = [e.name, e.name.replace(/\s*\(.*\)$/, ""), e.name.replace(/:.*$/, ""), e.input, ...(e.akas ?? []), ...shown];
  const out = new Set<string>();
  for (const x of base) {
    const f = fold(x);
    if (f.trim().length >= 3) out.add(f);
    // "The Mentalist" is also cited as "Mentalist" / "El Mentalista".
    const noArticle = f.replace(/^ (the|el|la|los|las) /, " ");
    if (noArticle.trim().length >= 3) out.add(noArticle);
  }
  return [...out];
}

/** Common sentence-initial or title words that are capitalized only by position. */
const COMMON = new Set(
  (
    "a al ante aunque bueno cada como con cuando cuidado de del desde donde el ella ellos en entonces era es esa ese eso esta este esto hasta hay la las le lo los mas mejor mientras mientras ni no nunca o ojo otra otro para pero plan planes por porque pues que quien riesgo se segun ser si sin sino siempre solo su sus tal tambien tan tanto todo todos tu un una uno y ya yo zona el aqui alla ahi ahora hoy manana ayer luego asi claro quizas quiza tampoco nadie algo alguien nada mucho poco muy casi jamas ojala dice dicen parece menos mi me nos les cual cuales sera seria fue ademas incluso total igual obvio oye mira vaya bien mal tiene tienen hace va van sale salen anda andan cuidadito " +
    "a after alibi all also an and another any as at be because before both but by cheating danger each either even every for from her here his how if in instead into is it its just let lets maybe meanwhile no nobody not now of on one only or other our out plan plans risk safe she since so some still that the their them then there they this to too until watch we what when where whether while who why with without yes you your zone he him we us me my mine sometimes often never always usually today tonight tomorrow yesterday well oh wow guess looks seems turns hey okay ok luckily honestly apparently clearly obviously though thus yet does do did has have had can could would should will might must was were are am been being dont doesnt cant wont isnt whos thats whats theres heres hes shes theyre lets sure good bad ever someone something nothing everyone everything nobody anyone really"
  ).split(" "),
);

/** Always-allowed proper names (days, months, generic). */
const ALWAYS = new Set("qloo colombia colombiano colombiana monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december i".split(" "));

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sentences = (t: string) => t.split(/(?<=[.!?…])\s+/).filter(Boolean);

function findAll(hay: string, needle: string): number[] {
  const out: number[] = [];
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) out.push(i);
  return out;
}

/** Check 1: who each cited taste is attributed to (nearest nickname before it, else after). */
export function checkAttribution(text: string, ctx: OwnershipCtx): CheckResult {
  const people = [ctx.a, ctx.b];
  const owned = people.flatMap((p, pi) => p.tastes.flatMap((e) => aliases(e, []).map((al) => ({ al, pi, name: e.name }))));
  // Longest aliases first so "harry potter & the prisoner…" wins over "harry potter".
  owned.sort((x, y) => y.al.length - x.al.length);
  for (const s of sentences(text)) {
    const f = fold(s);
    const nicks = people.flatMap((p, pi) => findAll(f, fold(p.nick)).map((at) => ({ at, pi })));
    if (!nicks.length) continue;
    const taken: [number, number][] = [];
    for (const o of owned) {
      for (const at of findAll(f, o.al)) {
        const end = at + o.al.length;
        if (taken.some(([x, y]) => at < y && end > x)) continue;
        taken.push([at, end]);
        const owners = new Set(owned.filter((x) => x.al === o.al || x.name === o.name).map((x) => x.pi));
        // "Fast & Furious de Ana" / "of Ana": explicit owner right after the mention.
        const after = f.slice(end - 1);
        const explicit = people.findIndex((p) => new RegExp(`^ (de|of) ${esc(fold(p.nick).trim())} `).test(after));
        const before = nicks.filter((n) => n.at < at).sort((x, y) => y.at - x.at)[0];
        const next = nicks.filter((n) => n.at >= end).sort((x, y) => x.at - y.at)[0];
        const who = explicit >= 0 ? explicit : (before ?? next)?.pi;
        if (who !== undefined && !owners.has(who)) {
          return { ok: false, reason: `"${o.name}" attributed to ${people[who].nick}, but it's ${people[[...owners][0]].nick}'s` };
        }
      }
    }
  }
  return { ok: true };
}

/** Check 2: capitalized names must come from Qloo data (tastes, their descriptions/akas, places, city). */
export function checkReferences(text: string, ctx: OwnershipCtx): CheckResult {
  const allowed = new Set<string>(ALWAYS);
  const add = (s?: string) => fold(s ?? "").trim().split(" ").forEach((w) => w && allowed.add(w));
  for (const p of [ctx.a, ctx.b]) {
    add(p.nick);
    for (const e of p.tastes) [e.name, e.input, ...(e.akas ?? []), e.facts].forEach(add);
    (p.shown ?? []).forEach(add);
  }
  ctx.vocab.forEach(add);
  for (const s of sentences(text)) {
    const words = [...s.matchAll(/[\p{L}\p{N}](?:[\p{L}\p{N}]|['’-](?=[\p{L}\p{N}]))*/gu)];
    words.forEach((m, i) => {
      if (allowed.has("__fail__")) return;
      const w = m[0];
      if (!/^\p{Lu}/u.test(w) || w.length === 1) return;
      const f = fold(w).trim();
      for (const part of f.split(" ")) {
        if (allowed.has(part)) continue;
        // Sentence-initial words are capitalized by position: allow common words, and a lone
        // capitalized first word (next word lowercase); the judge still checks named things.
        if (i === 0 && (COMMON.has(part) || (words.length > 1 && !/^\p{Lu}/u.test(words[1][0])))) continue;
        allowed.add("__fail__");
        allowed.add(`__word__${w}`);
      }
    });
  }
  const bad = [...allowed].find((x) => x.startsWith("__word__"));
  return bad ? { ok: false, reason: `unknown reference "${bad.slice(8)}"` } : { ok: true };
}

/** Both checks over the title punchline and the roast together. */
export function checkJoke(title: string, roast: string, ctx: OwnershipCtx): CheckResult {
  const tail = title.split("·").slice(1).join("·").trim();
  const text = tail ? `${tail}. ${roast}` : roast;
  const a = checkAttribution(text, ctx);
  if (!a.ok) return a;
  return checkReferences(text, ctx);
}
