import type { Pin, ScoreResult, SharedTag, ZonedPlace, ZoneExample, ZoneStat } from "../types";

/** How many top places per person we compare. */
export const TOP_PLACES = 25;
/** Weights of the final compatibility score. */
export const WEIGHTS = { tags: 0.6, places: 0.4 } as const;

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/**
 * Taste-tag similarity from Qloo /v2/insights/compare.
 * Qloo tag scores cluster around 0.5 (unrelated) to ~0.73 (very aligned), so we
 * rescale that band to 0-100 and dampen results backed by few shared tags.
 */
export function tagSimilarity(tags: SharedTag[]): number {
  if (!tags.length) return 0;
  const mean = tags.reduce((s, t) => s + t.score, 0) / tags.length;
  const coverage = Math.min(1, tags.length / 40);
  return clamp(((mean - 0.5) / 0.23) * 100) * coverage;
}

/** Jaccard overlap (0-100) of each person's top-N recommended place ids. */
export function placeOverlap(a: string[], b: string[]): { score: number; shared: number } {
  const sa = new Set(a);
  const sb = new Set(b);
  const shared = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return { score: union ? (shared / union) * 100 : 0, shared };
}

/** Builds map pins: places both would pick, or only one of them. */
export function buildPins(pa: ZonedPlace[], pb: ZonedPlace[]): Pin[] {
  const idsB = new Set(pb.map((p) => p.id));
  const pins = new Map<string, Pin>();
  const toPin = (p: ZonedPlace, who: Pin["who"]): Pin => ({
    id: p.id, name: p.name, lat: p.lat, lon: p.lon, who, zone: p.zone, genre: p.genre, rating: p.rating, image: p.image,
  });
  for (const p of pa) pins.set(p.id, toPin(p, idsB.has(p.id) ? "both" : "a"));
  for (const p of pb) if (!pins.has(p.id)) pins.set(p.id, toPin(p, "b"));
  return [...pins.values()];
}

/** Per-zone disagreement: share of a zone's places that only one person would choose. */
export function zoneStats(pins: Pin[]): ZoneStat[] {
  const acc = new Map<string, { both: number; n: number; lat: number; lon: number; onlyA?: ZoneExample; onlyB?: ZoneExample }>();
  for (const p of pins) {
    const z = acc.get(p.zone) ?? { both: 0, n: 0, lat: 0, lon: 0 };
    z.n++;
    if (p.who === "both") z.both++;
    // First pin per side = highest-ranked Qloo pick for that person in this zone.
    if (p.who === "a" && !z.onlyA) z.onlyA = { name: p.name, genre: p.genre };
    if (p.who === "b" && !z.onlyB) z.onlyB = { name: p.name, genre: p.genre };
    z.lat += p.lat;
    z.lon += p.lon;
    acc.set(p.zone, z);
  }
  return [...acc.entries()]
    .map(([zone, z]) => ({
      zone, n: z.n, both: z.both, clashPct: Math.round(((z.n - z.both) / z.n) * 100), lat: z.lat / z.n, lon: z.lon / z.n,
      ...(z.onlyA && { onlyA: z.onlyA }), ...(z.onlyB && { onlyB: z.onlyB }),
    }))
    // Most disagreements first (count of one-sided places), then the higher share.
    .sort((x, y) => y.n - y.both - (x.n - x.both) || y.clashPct - x.clashPct || y.n - x.n);
}

/** Full score: 60% shared taste tags + 40% overlap of recommended places. */
export function score(tags: SharedTag[], placesA: ZonedPlace[], placesB: ZonedPlace[]): ScoreResult {
  const ta = placesA.slice(0, TOP_PLACES);
  const tb = placesB.slice(0, TOP_PLACES);
  const tagScore = tagSimilarity(tags);
  const overlap = placeOverlap(ta.map((p) => p.id), tb.map((p) => p.id));
  const compat = Math.round(WEIGHTS.tags * tagScore + WEIGHTS.places * overlap.score);
  const pins = buildPins(ta, tb);
  return {
    compat,
    cachos: 100 - compat,
    tagScore: Math.round(tagScore),
    placeScore: Math.round(overlap.score),
    shared: overlap.shared,
    pins,
    zones: zoneStats(pins),
    topTags: [...tags].sort((x, y) => y.score - x.score).slice(0, 8),
  };
}
