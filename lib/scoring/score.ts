import type { Pin, RiskLevel, ScoreResult, SharedTag, ZonedPlace, ZoneExample, ZoneStat } from "../types";
import { zoneProfile } from "../geo/zoneProfile";

/**
 * How many favorite places per person we compare. Qloo's place lists in a city share
 * a popular core, so a shorter list (each person's top 20) reflects taste better.
 */
export const TOP_PLACES = 20;

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

export function riskLevel(risk: number): RiskLevel {
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

/** Full score from each person's Qloo place picks (and taste tags as a secondary stat). */
export function score(tags: SharedTag[], placesA: ZonedPlace[], placesB: ZonedPlace[]): ScoreResult {
  const ta = placesA.slice(0, TOP_PLACES);
  const tb = placesB.slice(0, TOP_PLACES);
  const r = cheatingRisk(ta.map((p) => p.id), tb.map((p) => p.id));
  const pins = buildPins(ta, tb);
  return {
    risk: r.risk,
    level: riskLevel(r.risk),
    onlyA: r.onlyA,
    onlyB: r.onlyB,
    totalA: ta.length,
    totalB: tb.length,
    shared: r.shared,
    tagScore: Math.round(tagSimilarity(tags)),
    pins,
    zones: zoneStats(pins),
    topTags: [...tags].sort((x, y) => y.score - x.score).slice(0, 8),
  };
}
