/**
 * Is the thing Qloo returned really the taste we asked for? Qloo's search returns its
 * best hit for anything ("kdramas" -> "40k", "strawberries and cream" -> "Waffle With
 * Strawberry And Ice Cream"), so every match is checked before we use it.
 */

const STOP = new Set(["the", "a", "an", "of", "and", "y", "de", "la", "el", "los", "las", "le", "les", "du", "des", "et", "and"]);

export const foldText = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/&/g, " and ").replace(/['’]s\b/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Light stemming so "dramas"/"drama", "strawberries"/"strawberry", "movies"/"movie" match. */
const stem = (w: string) => w.replace(/ies$/, "y").replace(/(?<=[^s])s$/, "");

export const tokens = (s: string) => foldText(s).split(" ").filter((w) => w && !STOP.has(w)).map(stem);

function bigrams(s: string): string[] {
  const t = foldText(s).replace(/\s+/g, "");
  return t.length < 2 ? [t] : [...t].slice(0, -1).map((_, i) => t.slice(i, i + 2));
}

/** Sørensen–Dice similarity over character bigrams (spaces/punctuation ignored): 0..1. */
export function dice(x: string, y: string): number {
  const a = bigrams(x);
  const b = bigrams(y);
  if (!a.length || !b.length) return 0;
  const pool = new Map<string, number>();
  for (const g of b) pool.set(g, (pool.get(g) ?? 0) + 1);
  let hit = 0;
  for (const g of a) {
    const n = pool.get(g) ?? 0;
    if (n > 0) { hit++; pool.set(g, n - 1); }
  }
  return (2 * hit) / (a.length + b.length);
}

export interface MatchCheck {
  ok: boolean;
  score: number;
}

/**
 * Confidence that `name` (what Qloo returned) is `query` (what we meant).
 * - strict (tags/categories): every word of the tag must be in the query, or the strings nearly equal.
 *   Rejects "Waffle With Strawberry And Ice Cream" for "strawberries and cream" and "40k" for "k-drama".
 * - titles: all query words appear in the name (allowing a couple of extra words like "The"/"Saga"),
 *   or close spelling (typos), or one of Qloo's alternate titles matches.
 */
export function matchConfidence(query: string, name: string, opts: { strict?: boolean; akas?: string[] } = {}): MatchCheck {
  const q = tokens(query);
  const best = (n: string): number => {
    const t = tokens(n);
    if (!q.length || !t.length) return 0;
    const d = dice(query, n);
    const qInT = q.filter((w) => t.includes(w)).length / q.length;
    const tInQ = t.filter((w) => q.includes(w)).length / t.length;
    // Strict: the tag must cover the whole query ("Drama" is not "K-drama"), allowing one missing word in 3+ word queries.
    if (opts.strict) {
      if (tInQ === 1 && (qInT === 1 || (q.length >= 3 && qInT >= 0.66))) return Math.max(d, 0.8);
      // Spelling variants only ("kdramas" ~ "Kdrama"), never a shorter/longer different tag.
      return t.length === q.length ? d : Math.min(d, 0.5);
    }
    if (qInT === 1 && t.length <= q.length + 2) return Math.max(d, 0.85);
    if (tInQ === 1 && qInT >= 0.5) return Math.max(d, 0.75);
    return d;
  };
  const score = Math.max(best(name), ...(opts.akas ?? []).map(best));
  return { ok: score >= (opts.strict ? 0.75 : 0.6), score: Math.round(score * 100) / 100 };
}
