import type { Pin, RiskLevel, ScoreResult, SharedTag, TasteEntity, ZonedPlace, ZoneExample, ZoneStat } from "../types";
import { zoneProfile } from "../geo/zoneProfile";

/**
 * How many favorite places per person we compare. Qloo's place lists in a city share
 * a popular core, so a shorter list (each person's top 20) reflects taste better.
 */
export const TOP_PLACES = 20;
/** How deep in the other person's ranked list a place still counts as "theirs too". */
export const DEEP_PLACES = 30;
/** Weight of Qloo's tag affinity inside the taste part (the rest is shared tastes). */
const AFFINITY_WEIGHT = 0.15;

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/**
 * Taste-tag affinity from Qloo /v2/insights/compare (secondary stat).
 * Qloo tag scores cluster around 0.5 (unrelated) to ~0.73 (very aligned), so we
 * rescale that band to 0-100 and dampen results backed by few shared tags.
 */
export function tagSimilarity(tags: SharedTag[]): number {
  if (!tags.length) return 0;
  const mean = tags.reduce((s, t) => s + t.score, 0) / tags.length;
  const coverage = Math.min(1, tags.length / 40);
  return clamp(((mean - 0.5) / 0.23) * 100) * coverage;
}

/**
 * Cheating risk (0-100): of the places each person likes, the share the other
 * doesn't, averaged over both. "53%" = 53% of the plans one likes, the other doesn't.
 */
export function cheatingRisk(a: string[], b: string[]): { risk: number; onlyA: number; onlyB: number; shared: number } {
  const sa = new Set(a);
  const sb = new Set(b);
  const shared = [...sa].filter((x) => sb.has(x)).length;
  const onlyA = sa.size - shared;
  const onlyB = sb.size - shared;
  if (!sa.size || !sb.size) return { risk: 100, onlyA, onlyB, shared };
  const risk = ((onlyA / sa.size + onlyB / sb.size) / 2) * 100;
  return { risk: Math.round(risk), onlyA, onlyB, shared };
}

/** Nobody is 100% safe: the shown risk never goes below this. */
export const RISK_FLOOR = 5;
/** At or below this, the couple is "blindada" (armored). */
export const ARMORED_MAX = 10;

export function riskLevel(risk: number): RiskLevel {
  if (risk <= ARMORED_MAX) return "armored";
  if (risk < 35) return "low";
  if (risk < 60) return "medium";
  if (risk < 80) return "high";
  return "cheating";
}

/** Builds map pins: places both would like, or only one of them. */
export function buildPins(pa: ZonedPlace[], pb: ZonedPlace[]): Pin[] {
  const byB = new Map(pb.map((p) => [p.id, p]));
  const pins = new Map<string, Pin>();
  const toPin = (p: ZonedPlace, who: Pin["who"], fromA?: number[], fromB?: number[]): Pin => ({
    id: p.id, name: p.name, lat: p.lat, lon: p.lon, who, zone: p.zone, genre: p.genre, rating: p.rating, image: p.image,
    priceLevel: p.priceLevel, description: p.description, tags: p.tags,
    ...(fromA?.length && { fromA }), ...(fromB?.length && { fromB }),
  });
  for (const p of pa) pins.set(p.id, toPin(p, byB.has(p.id) ? "both" : "a", p.from, byB.get(p.id)?.from));
  for (const p of pb) if (!pins.has(p.id)) pins.set(p.id, toPin(p, "b", undefined, p.from));
  return [...pins.values()];
}

/**
 * Per-zone risk: share of a zone's places that only one person likes.
 * "danger" zones are where one of them would go alone; "safe" zones they'd enjoy together.
 */
export function zoneStats(pins: Pin[]): ZoneStat[] {
  const groups = new Map<string, Pin[]>();
  for (const p of pins) groups.set(p.zone, [...(groups.get(p.zone) ?? []), p]);
  return [...groups.entries()]
    .map(([zone, ps]) => {
      const both = ps.filter((p) => p.who === "both").length;
      const a = ps.filter((p) => p.who === "a").length;
      const b = ps.filter((p) => p.who === "b").length;
      const riskPct = Math.round(((ps.length - both) / ps.length) * 100);
      // First pin per side = highest-ranked Qloo pick for that person in this zone.
      const ex = (who: Pin["who"]): ZoneExample | undefined => {
        const p = ps.find((x) => x.who === who);
        return p && { name: p.name, genre: p.genre };
      };
      const onlyA = ex("a");
      const onlyB = ex("b");
      // Which tastes brought this zone's places, per person (strongest taste per place).
      const count = (key: "fromA" | "fromB"): [number, number][] => {
        const m = new Map<number, number>();
        for (const p of ps) { const i = p[key]?.[0]; if (i != null) m.set(i, (m.get(i) ?? 0) + 1); }
        return [...m].sort((x, y) => y[1] - x[1]);
      };
      return {
        zone, n: ps.length, both, a, b, riskPct,
        kind: (riskPct >= 50 ? "danger" : "safe") as ZoneStat["kind"],
        lat: ps.reduce((s, p) => s + p.lat, 0) / ps.length,
        lon: ps.reduce((s, p) => s + p.lon, 0) / ps.length,
        profile: zoneProfile(ps),
        byA: count("fromA"), byB: count("fromB"),
        ...(onlyA && { onlyA }), ...(onlyB && { onlyB }),
      };
    })
    // Most one-sided places first, then higher share, then bigger zones.
    .sort((x, y) => y.n - y.both - (x.n - x.both) || y.riskPct - x.riskPct || y.n - x.n);
}

export interface ScoreOptions {
  /** Each person's deeper ranked list (id + tastes that brought it). */
  deepA?: { id: string; from?: number[] }[];
  deepB?: { id: string; from?: number[] }[];
  /** Resolved tastes, with `pair` = index of the other's same-kind taste. */
  tastesA?: TasteEntity[];
  tastesB?: TasteEntity[];
}

/**
 * Full score. Risk = average of two parts:
 *  - tastes: share of each person's tastes with no same-kind counterpart in the other's
 *    (blended with Qloo's tag affinity when available);
 *  - plans: share of each person's top places the other wouldn't share — not in the
 *    other's deeper Qloo list and not brought by a taste they share.
 * Without taste info (tests/legacy) only the plans part is used.
 */
export function score(tags: SharedTag[], placesA: ZonedPlace[], placesB: ZonedPlace[], opt: ScoreOptions = {}): ScoreResult {
  const ta = placesA.slice(0, TOP_PLACES);
  const tb = placesB.slice(0, TOP_PLACES);
  const deep = (d: ScoreOptions["deepA"], top: ZonedPlace[]) => new Map((d ?? top).slice(0, DEEP_PLACES).map((p) => [p.id, p.from]));
  const deepA = deep(opt.deepA, ta);
  const deepB = deep(opt.deepB, tb);
  const tastePair = (from: number[] | undefined, mine?: TasteEntity[]) => from?.map((i) => mine?.[i]?.pair).find((j) => j != null);
  const pins = new Map<string, Pin>();
  const toPin = (p: ZonedPlace, who: Pin["who"], fromA?: number[], fromB?: number[], via?: "a" | "b"): Pin => ({
    id: p.id, name: p.name, lat: p.lat, lon: p.lon, who, zone: p.zone, genre: p.genre, rating: p.rating, image: p.image,
    priceLevel: p.priceLevel, description: p.description, tags: p.tags,
    ...(fromA?.length && { fromA }), ...(fromB?.length && { fromB }), ...(via && { via }),
  });
  let sharedA = 0;
  let sharedB = 0;
  for (const p of ta) {
    if (deepB.has(p.id)) { sharedA++; pins.set(p.id, toPin(p, "both", p.from, deepB.get(p.id))); continue; }
    const j = tastePair(p.from, opt.tastesA);
    if (j != null) { sharedA++; pins.set(p.id, toPin(p, "both", p.from, [j], "a")); continue; }
    pins.set(p.id, toPin(p, "a", p.from));
  }
  for (const p of tb) {
    const had = pins.get(p.id);
    const inA = deepA.has(p.id);
    const j = tastePair(p.from, opt.tastesB);
    if (inA || j != null) sharedB++;
    // In both top lists: A's pass already pinned it as "both" (B's top is part of B's deep list).
    if (had) continue;
    if (inA) pins.set(p.id, toPin(p, "both", deepA.get(p.id), p.from));
    else if (j != null) pins.set(p.id, toPin(p, "both", [j], p.from, "b"));
    else pins.set(p.id, toPin(p, "b", undefined, p.from));
  }
  const placeRisk = !ta.length || !tb.length ? 100 : ((1 - sharedA / ta.length + (1 - sharedB / tb.length)) / 2) * 100;
  const tagScore = Math.round(tagSimilarity(tags));
  let tasteRisk: number | undefined;
  let pairedA: number | undefined;
  let pairedB: number | undefined;
  if (opt.tastesA?.length && opt.tastesB?.length) {
    pairedA = opt.tastesA.filter((e) => e.pair != null).length;
    pairedB = opt.tastesB.filter((e) => e.pair != null).length;
    const share = (pairedA / opt.tastesA.length + pairedB / opt.tastesB.length) / 2;
    const sim = tags.length ? (1 - AFFINITY_WEIGHT) * share + AFFINITY_WEIGHT * (tagScore / 100) : share;
    tasteRisk = Math.round((1 - sim) * 100);
  }
  const pr = Math.round(placeRisk);
  const rawRisk = tasteRisk == null ? pr : Math.round((tasteRisk + pr) / 2);
  const risk = Math.max(RISK_FLOOR, rawRisk);
  const all = [...pins.values()];
  return {
    risk,
    level: riskLevel(risk),
    rawRisk,
    onlyA: ta.length - sharedA,
    onlyB: tb.length - sharedB,
    totalA: ta.length,
    totalB: tb.length,
    shared: all.filter((p) => p.who === "both").length,
    tagScore,
    ...(tasteRisk != null && { tasteRisk, placeRisk: pr, pairedA, pairedB }),
    pins: all,
    zones: zoneStats(all),
    topTags: [...tags].sort((x, y) => y.score - x.score).slice(0, 8),
  };
}
