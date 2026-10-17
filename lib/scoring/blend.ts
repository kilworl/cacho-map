/**
 * Builds each person's favorite-place list as a blend of one Qloo list per input
 * (each title, cuisine or category gets its own /v2/insights call), so one input
 * can't take over the whole list, and removes "popular for anyone" places.
 */

/**
 * "typed" = places of the kinds a taste obviously leads to (gyms for "gym", cinemas for
 * "anime"), ranked by Qloo for that taste: the most telling lists. The others are Qloo's
 * general place picks for a title / cuisine / category signal.
 */
export type InputKind = "typed" | "title" | "cuisine" | "category";

/** Relative weight by input kind: typed and specific titles count most, broad categories least. */
export const KIND_WEIGHT: Record<InputKind, number> = { typed: 1.2, title: 1, cuisine: 0.6, category: 0.3 };
/** No single input may contribute more than this share of a person's blend (when there are 3+ inputs). */
export const MAX_SHARE = 0.4;
/** Ranks deeper than this in a list score 0. */
const DEPTH = 50;

export interface InputList<T extends { id: string }> {
  kind: InputKind;
  places: T[];
}

/** Normalized weights per input, capped at MAX_SHARE (water-filling), summing to 1. */
export function inputWeights(kinds: InputKind[]): number[] {
  const n = kinds.length;
  if (!n) return [];
  const cap = Math.max(MAX_SHARE, 1 / n);
  let w = kinds.map((k) => KIND_WEIGHT[k]);
  const capped = new Set<number>();
  for (let iter = 0; iter < n; iter++) {
    const freeSum = w.reduce((s, x, i) => (capped.has(i) ? s : s + x), 0);
    const left = 1 - capped.size * cap;
    w = w.map((x, i) => (capped.has(i) ? cap : (x / freeSum) * left));
    const over = w.findIndex((x, i) => !capped.has(i) && x > cap + 1e-9);
    if (over < 0) break;
    capped.add(over);
  }
  return w;
}

/**
 * Places Qloo recommends to almost anyone here: present in at least `share` of all
 * per-input lists (from both people). Needs 4+ lists to say anything.
 */
export function popularBaseline<T extends { id: string }>(lists: T[][], share = 0.7, minLists = 4): Map<string, number> {
  const freq = new Map<string, number>();
  if (lists.length < minLists) return freq;
  for (const l of lists) for (const id of new Set(l.slice(0, DEPTH).map((p) => p.id))) freq.set(id, (freq.get(id) ?? 0) + 1);
  const min = Math.ceil(lists.length * share);
  return new Map([...freq].filter(([, c]) => c >= min));
}

/**
 * Weighted rank-score blend of a person's per-input lists. `from` lists the inputs
 * (list indices) that brought each place, biggest contribution first: that's the
 * "you get this place because of your taste for X" explanation.
 */
export function blendScores<T extends { id: string }>(lists: InputList<T>[]): { place: T; score: number; from: number[] }[] {
  const w = inputWeights(lists.map((l) => l.kind));
  const acc = new Map<string, { place: T; score: number; first: number; parts: Map<number, number> }>();
  let order = 0;
  lists.forEach((l, i) =>
    l.places.slice(0, DEPTH).forEach((p, rank) => {
      const s = w[i] * (1 - rank / DEPTH);
      const cur = acc.get(p.id);
      if (cur) {
        cur.score += s;
        cur.parts.set(i, (cur.parts.get(i) ?? 0) + s);
      } else acc.set(p.id, { place: p, score: s, first: order++, parts: new Map([[i, s]]) });
    }),
  );
  return [...acc.values()]
    .sort((x, y) => y.score - x.score || x.first - y.first)
    .map(({ place, score, parts }) => ({ place, score, from: [...parts].sort((x, y) => y[1] - x[1]).map(([i]) => i) }));
}

/**
 * Each person's top-N blended favorites, after dropping the most "popular for anyone"
 * places, as long as both people keep at least N candidates.
 */
export function favoritePlaces<T extends { id: string }>(
  a: InputList<T>[],
  b: InputList<T>[],
  top = 20,
  /** Lists for unrelated "probe" tastes in the same city; what they share is popular for anyone. */
  probes?: T[][],
  /** How many ranked places to return per person (>= top); the extra ones are for overlap checks. */
  depth = top,
): { a: (T & { from: number[] })[]; b: (T & { from: number[] })[]; generic: string[] } {
  const sa = blendScores(a);
  const sb = blendScores(b);
  const base = probes && probes.length >= 3 ? popularBaseline(probes, 0.75, 3) : popularBaseline([...a, ...b].map((l) => l.places));
  const generic = [...base].sort((x, y) => y[1] - x[1]).map(([id]) => id);
  const removed = new Set<string>();
  for (const id of generic) {
    const left = (s: typeof sa) => s.filter((x) => !removed.has(x.place.id) && x.place.id !== id).length;
    if (left(sa) < top || left(sb) < top) break;
    removed.add(id);
  }
  const pick = (s: typeof sa) => s.filter((x) => !removed.has(x.place.id)).slice(0, depth).map((x) => ({ ...x.place, from: x.from }));
  return { a: pick(sa), b: pick(sb), generic: [...removed] };
}
