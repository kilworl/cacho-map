import { generateText, Output } from "ai";
import { z } from "zod";
import type { Lang, Pin, ScoreResult, ZoneStat } from "../types";
import { normalizeModelId } from "./model";
import { fixGender, pronounHint, type Person } from "./gender";
import { ambience, placeType, priceSigns } from "../i18n/placeTypes";
import { inLang } from "./sanitize";

/** How many zones / places get an LLM-phrased description. */
export const ZONES_TO_DESCRIBE = 5;
export const PLACES_TO_DESCRIBE = 26;

const Schema = z.object({
  zones: z.array(z.object({ zone: z.string(), description: z.string() })),
  places: z.array(z.object({ id: z.string(), summary: z.string(), plan: z.string() })),
});

interface Ctx {
  a: string;
  b: string;
  pa: Person;
  pb: Person;
  tastesA: string[];
  tastesB: string[];
  lang: Lang;
}

const list = (xs: string[], lang: Lang) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${lang === "es" ? "y" : "and"} ${xs.at(-1)}`);

/** Deterministic zone copy built only from the Qloo profile. */
export function templateZone(z: ZoneStat, { a, b, lang }: Ctx): { description: string; why: string } {
  const types = [...new Set(z.profile.genres.map((g) => placeType(g, lang)).filter((t) => t && (t.known || lang === "en")).map((t) => t!.plural))].slice(0, 2);
  const vibe = [...new Set(z.profile.ambience.map((x) => ambience(x.replace(/ vibe$/i, ""), lang)).filter((x): x is string => !!x))].slice(0, 2);
  const price = priceSigns(z.profile.avgPrice);
  const es = lang === "es";
  const description = types.length
    ? es
      ? `Zona de ${list(types, lang)}${vibe.length ? `, ambiente ${list(vibe, lang)} (según Qloo)` : ""}${price ? `, precios ${price}` : ""}.`
      : `Area of ${list(types, lang)}${vibe.length ? `, ${list(vibe, lang)} vibe (per Qloo)` : ""}${price ? `, prices ${price}` : ""}.`
    : es ? `Zona con ${z.n} lugares que Qloo recomienda.` : `Area with ${z.n} places Qloo recommends.`;
  const ex = (side: "onlyA" | "onlyB") => z[side]?.name;
  const why = z.kind === "safe"
    ? es ? `Zona segura: ${z.both} de ${z.n} lugares les gustan a los dos, aquí salen juntos.` : `Safe zone: ${z.both} of ${z.n} places suit both, so they'd go together.`
    : z.a && z.b
      ? es ? `Peligro: ${a} vendría a ${ex("onlyA")} y ${b} a ${ex("onlyB")}, cada uno por su lado.` : `Danger: ${a} would come for ${ex("onlyA")} and ${b} for ${ex("onlyB")}, each on their own.`
      : es ? `Peligro: casi todo aquí es para ${z.a ? a : b}${ex(z.a ? "onlyA" : "onlyB") ? ` (como ${ex(z.a ? "onlyA" : "onlyB")})` : ""}; la otra persona no vendría.` : `Danger: almost everything here is for ${z.a ? a : b}${ex(z.a ? "onlyA" : "onlyB") ? ` (like ${ex(z.a ? "onlyA" : "onlyB")})` : ""}; the other wouldn't come.`;
  return { description, why };
}

/** Deterministic place copy: type (+ Qloo's English description in EN) and a plan from the type. */
export function templatePlace(p: Pin, lang: Lang): { summary: string; plan: string } {
  const genre = p.tags?.genres?.[0] ?? p.genre;
  const t = placeType(genre, lang);
  const cuisine = p.tags?.cuisines?.[0];
  // Spanish copy never shows Qloo's English tags: only types we can translate.
  const summary = lang === "en" ? p.description ?? [genre, cuisine].filter(Boolean).join(" · ") : t?.known ? t.plural.charAt(0).toUpperCase() + t.plural.slice(1) : "";
  const name = p.name.replace(/[.\s]+$/, "");
  const plan = t ? (lang === "es" ? `Plan: ${t.plan} en ${name}.` : `Plan: ${t.plan} at ${name}.`) : "";
  return { summary, plan };
}

const PRICE = { es: ["económico", "moderado", "algo caro", "caro"], en: ["cheap", "moderate", "pricey", "expensive"] };

function facts(r: ScoreResult, ctx: Ctx) {
  const who = (w: Pin["who"]) => (w === "both" ? "both" : w === "a" ? ctx.a : ctx.b);
  const zones = pickZones(r).map((z) => {
    const ps = r.pins.filter((p) => p.zone === z.zone);
    // Danger zones only show one-sided examples, safe zones only shared ones.
    const sides = z.kind === "danger" ? (["a", "b"] as const) : (["both"] as const);
    const examples = sides.flatMap((w) => ps.filter((p) => p.who === w).slice(0, 2))
      .map((p) => ({ name: p.name, liked_by: who(p.who), types: p.tags?.genres ?? [p.genre], cuisines: p.tags?.cuisines ?? [] }));
    return {
      zone: z.zone, kind: z.kind, places: z.n, both_like: z.both, only_a: z.a, only_b: z.b,
      place_types: z.profile.genres, cuisines: z.profile.cuisines, ambience: z.profile.ambience,
      price: z.profile.avgPrice ? PRICE[ctx.lang][Math.min(3, Math.max(0, Math.round(z.profile.avgPrice) - 1))] : null,
      examples,
    };
  });
  const places = r.pins.slice(0, PLACES_TO_DESCRIBE).map((p) => ({
    id: p.id, name: p.name, for: p.who === "both" ? "both" : p.who === "a" ? ctx.a : ctx.b,
    types: p.tags?.genres ?? [p.genre], cuisines: p.tags?.cuisines ?? [], ambience: p.tags?.ambience ?? [], activities: p.tags?.activities ?? [],
    qloo_description: p.description ?? null,
  }));
  return { zones, places };
}

export function pickZones(r: ScoreResult): ZoneStat[] {
  const danger = r.zones.filter((z) => z.kind === "danger").slice(0, 3);
  const safe = r.zones.filter((z) => z.kind === "safe").slice(0, ZONES_TO_DESCRIBE - danger.length);
  return [...danger, ...safe];
}

const system = (ctx: Ctx) => `You write short, factual copy for a couples' map app, in ${ctx.lang === "es" ? "neutral Colombian Spanish" : "English"}.
Person A is ${pronounHint(ctx.pa, ctx.lang)}, likes ${ctx.tastesA.join(", ")}. Person B is ${pronounHint(ctx.pb, ctx.lang)}, likes ${ctx.tastesB.join(", ")}.
STRICT RULE: use ONLY the facts in the JSON. Never invent places, foods, prices, history or vibes that are not listed. If a field is empty or null, don't mention it at all (never say something is "not specified"). Attribute a cuisine or type to a place only if that place's own fields list it.
For each zone:
- "description" (max 20 words): what the area is like (what kind of places, food, vibe, price), from place_types, cuisines, ambience, price. Don't mention the couple or the zone kind here.
For each place: "summary" (max 14 words): what it is, from types/cuisines/qloo_description (translated), without repeating the place name. "plan" (max 12 words): a concrete thing to do there, matching its type.
Respect each person's pronoun. Neutral: no gendered adjectives (${ctx.lang === "es" ? '"se iría sin compañía", never "solo/sola"' : 'use the name or "they"'}).
ALL output text must be in ${ctx.lang === "es" ? "Spanish (translate qloo_description and tags to Spanish)" : "English"}.
No exclamation marks, no emojis. Keep the same zone names and place ids.`;

/** LLM-phrased zone + place descriptions grounded in Qloo data; falls back to templates. */
export async function describe(r: ScoreResult, ctx: Ctx, timeoutMs = 12_000): Promise<ScoreResult> {
  const f = facts(r, ctx);
  const call = async (payload: object): Promise<Partial<z.infer<typeof Schema>>> => {
    try {
      const res = await generateText({
        model: normalizeModelId(),
        output: Output.object({ schema: Schema }),
        system: system(ctx),
        prompt: JSON.stringify(payload),
        temperature: 0.3,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(timeoutMs),
        providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
      } as Parameters<typeof generateText>[0]);
      return (res as unknown as { output?: z.infer<typeof Schema> }).output ?? {};
    } catch (e) {
      console.warn("describe fallback:", (e as Error).message);
      return {};
    }
  };
  // Smaller calls in parallel are much faster than one big one (output length dominates latency).
  // Fewer concurrent calls: the free tier throttles bursts (agent + judge run at the same time).
  const parts = await Promise.all([call({ zones: f.zones, places: [] }), call({ zones: [], places: f.places })]);
  const out = { zones: parts.flatMap((p) => p.zones ?? []), places: parts.flatMap((p) => p.places ?? []) };
  // Language guard: anything the model wrote in the wrong language is replaced by the template.
  const clean = (s?: string, name?: string) => {
    // Drop "prices not specified"-style filler the model adds despite the prompt.
    let t = s?.replace(/[!¡]/g, "").split(/(?<=[.])\s+/).filter((x) => !/no especificad|sin especificar|not specified|unspecified|no disponible|not available/i.test(x)).join(" ").trim();
    if (t && !inLang(t, ctx.lang)) return undefined;
    if (t && name && t.toLowerCase().startsWith(name.toLowerCase())) t = t.slice(name.length).replace(/^[\s:,.–-]+/, "");
    return t ? t.charAt(0).toLocaleUpperCase() + t.slice(1) : undefined;
  };
  const described = new Set(pickZones(r).map((z) => z.zone));
  return {
    ...r,
    zones: r.zones.map((z) => {
      const t = templateZone(z, ctx);
      const llm = described.has(z.zone) ? out.zones.find((x) => x.zone === z.zone) : undefined;
      return { ...z, description: clean(llm?.description) ?? t.description, why: t.why };
    }),
    pins: r.pins.map((p) => {
      const t = templatePlace(p, ctx.lang);
      const llm = out.places.find((x) => x.id === p.id);
      const plan = clean(llm?.plan) && fixGender(clean(llm?.plan)!, [ctx.pa, ctx.pb], ctx.lang);
      return { ...p, summary: clean(llm?.summary, p.name) ?? t.summary, plan: plan || t.plan };
    }),
  };
}
