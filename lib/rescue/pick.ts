/**
 * Rescue plan, pure part: from real Qloo places, pick 2-3 stops for a date that
 * satisfies BOTH people, and say which taste of each person every stop serves.
 *
 * Attribution, strongest first:
 *  1. the place is on that person's own Qloo list (it came from one of their tastes);
 *  2. the place is of a kind one of their tastes leads to (anime -> cinema, sushi -> sushi).
 * Stops that serve both win; if the couple shares too little, the plan alternates
 * (one stop for each), so nobody ends up going out alone.
 */
import type { GeoPoint, Place, RescueStop, TasteEntity } from "../types";
import { isPlaceKind, kindsOfGenres, type PlaceKind } from "../places/catalog";
import { distanceM } from "../geo/cities";
import { foldText } from "../tastes/match";

export const MAX_STOPS = 3;
/** Stops further than this from the couple are ignored. */
export const MAX_KM = 12;
/** Fine for one person, odd for a date. */
const NOT_A_DATE: PlaceKind[] = ["gym", "motorcycle", "clothing", "electronics", "tattoo", "mall", "stadium", "music_store"];

export interface Candidate extends Place {
  zone?: string;
}

interface Lists {
  /** Each person's ranked Qloo places (with `from` = their taste indices). */
  deepA: Candidate[];
  deepB: Candidate[];
  /** Places Qloo ranked for both profiles at once. */
  bridge: Candidate[];
  tastesA: TasteEntity[];
  tastesB: TasteEntity[];
  at: GeoPoint;
}

const placeKinds = (p: Place): PlaceKind[] => kindsOfGenres([...(p.tags?.genres ?? []), p.genre ?? ""]);

/** Taste indices whose place kinds or food query match this place. */
export function tastesForPlace(p: Place, tastes: TasteEntity[]): number[] {
  const kinds = new Set(placeKinds(p));
  const food = (p.tags?.cuisines ?? []).map(foldText);
  return tastes.flatMap((e, i) => {
    const byKind = (e.places ?? []).filter(isPlaceKind).some((k) => kinds.has(k));
    const q = foldText(e.label?.en ?? e.name);
    const byFood = e.kind === "food" && q.length > 2 && food.some((c) => c.includes(q) || q.includes(c));
    return byKind || byFood ? [i] : [];
  });
}

interface Scored extends Candidate {
  forA: number[];
  forB: number[];
  value: number;
  kinds: PlaceKind[];
}

export function scoreCandidates({ deepA, deepB, bridge, tastesA, tastesB, at }: Lists): Scored[] {
  const rankA = new Map(deepA.map((p, i) => [p.id, { i, from: p.from ?? [] }]));
  const rankB = new Map(deepB.map((p, i) => [p.id, { i, from: p.from ?? [] }]));
  const bridgeRank = new Map(bridge.map((p, i) => [p.id, i]));
  const pool = new Map<string, Candidate>();
  for (const p of [...bridge, ...deepA, ...deepB]) if (!pool.has(p.id)) pool.set(p.id, p);
  const out: Scored[] = [];
  for (const p of pool.values()) {
    const km = distanceM(at, p) / 1000;
    if (km > MAX_KM) continue;
    const kinds = placeKinds(p);
    const own = (r: typeof rankA, tastes: TasteEntity[]) => {
      const hit = r.get(p.id);
      return hit?.from.length ? hit.from : tastesForPlace(p, tastes);
    };
    const forA = [...new Set(own(rankA, tastesA))].slice(0, 2);
    const forB = [...new Set(own(rankB, tastesB))].slice(0, 2);
    if (!forA.length && !forB.length) continue;
    // Rank closeness on each list (0..1), both-sided bonus, Qloo's joint ranking, distance.
    const near = (r: typeof rankA, n: number) => (r.has(p.id) ? 1 - r.get(p.id)!.i / Math.max(1, n) : 0);
    let value = (forA.length && forB.length ? 3 : 0) + near(rankA, deepA.length) + near(rankB, deepB.length);
    if (bridgeRank.has(p.id)) value += 1 - bridgeRank.get(p.id)! / Math.max(1, bridge.length);
    if (kinds.some((k) => NOT_A_DATE.includes(k))) value -= 2.5;
    // A date is a walk, not a road trip: every 5 km costs about one "both like it" bonus.
    value -= (km / 5) * 1.5;
    out.push({ ...p, forA, forB, value, kinds });
  }
  return out.sort((x, y) => y.value - x.value);
}

const sameKind = (x: Scored, y: Scored) => x.kinds.length > 0 && x.kinds.some((k) => y.kinds.includes(k));
const sameName = (x: Place, y: Place) => foldText(x.name) === foldText(y.name);

/**
 * Up to 3 stops: places for both first (different kinds of place, so it's a real
 * outing and not three bars), then, if needed, alternate one stop per person.
 * Ordered as a walkable route starting from the couple's location.
 */
export function pickStops(lists: Lists, max = MAX_STOPS): RescueStop[] {
  const scored = scoreCandidates(lists);
  const chosen: Scored[] = [];
  const fits = (c: Scored) => !chosen.some((x) => x.id === c.id || sameName(x, c) || sameKind(x, c));
  for (const c of scored) if (chosen.length < max && c.forA.length && c.forB.length && fits(c)) chosen.push(c);
  // Not enough shared places: balance the date, the person with fewer stops picks next.
  while (chosen.length < Math.min(max, 2)) {
    const forA = chosen.filter((x) => x.forA.length).length;
    const forB = chosen.filter((x) => x.forB.length).length;
    const side = forA <= forB ? "forA" : "forB";
    const next = scored.find((c) => c[side].length && fits(c)) ?? scored.find((c) => fits(c));
    if (!next) break;
    chosen.push(next);
  }
  return route(chosen, lists.at);
}

/** Nearest-neighbour route from the start point, with the km of each leg. */
export function route<T extends GeoPoint & Candidate & { forA: number[]; forB: number[] }>(stops: T[], start: GeoPoint): RescueStop[] {
  const left = [...stops];
  const out: RescueStop[] = [];
  let here = start;
  while (left.length) {
    left.sort((x, y) => distanceM(here, x) - distanceM(here, y));
    const s = left.shift()!;
    out.push({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, zone: s.zone, genre: s.tags?.genres?.[0] ?? s.genre, forA: s.forA, forB: s.forB, km: Math.round(distanceM(here, s) / 100) / 10 });
    here = s;
  }
  return out;
}
