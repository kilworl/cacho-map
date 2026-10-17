/**
 * Near-duplicate tastes. People describe one taste several ways ("ceviche, mariscos y comida
 * de mar"; "salsa" vs "bailar salsa"). Counting each as its own list made one taste crowd
 * a person's top places, and made two people who like the same thing look different.
 *  - mergeDuplicates: folds a person's near-duplicates into one taste.
 *  - pairTastes: links each taste to the other person's same-kind taste (shared taste) and
 *    gives a signal-less activity the partner's Qloo signal, so both resolve the same way.
 */
import type { TasteEntity, TasteLabel } from "../types";
import { foldText, matchConfidence } from "./match";

const placeKey = (e: TasteEntity) => [...(e.places ?? [])].sort().join("+");

const jaccard = (x: string[], y: string[]) => {
  const a = new Set(x);
  const b = new Set(y);
  const inter = [...a].filter((k) => b.has(k)).length;
  return a.size + b.size ? inter / (a.size + b.size - inter) : 0;
};

/** A title whose Qloo facts name the genre ("Making a Murderer … true crime documentary" ~ "true crime"). */
const titleOfGenre = (t: TasteEntity, g: TasteEntity) => {
  if (t.kind !== "title" || g.kind !== "genre") return false;
  const text = ` ${foldText(`${t.name} ${t.facts ?? ""}`)} `;
  return [g.name, g.label?.en].some((n) => n && foldText(n).length >= 4 && text.includes(` ${foldText(n)} `));
};

/**
 * Same kind of thing: same Qloo id or label; foods with the same place kinds; signal-less
 * activities with mostly the same place kinds. Across a couple (`cross`), a title also
 * matches the genre it belongs to (Diomedes Díaz ~ vallenato).
 */
export function sameTaste(x: TasteEntity, y: TasteEntity, cross = false): boolean {
  const sx = x.signal !== false;
  const sy = y.signal !== false;
  if (sx && sy && x.id === y.id) return true;
  const lx = x.label?.en ?? x.input;
  const ly = y.label?.en ?? y.input;
  if (matchConfidence(lx, ly, { strict: true }).ok && matchConfidence(ly, lx, { strict: true }).ok) return true;
  const px = x.places ?? [];
  const py = y.places ?? [];
  const same = !!px.length && placeKey(x) === placeKey(y);
  // Two signal-less activities: same place kinds, or mostly the same with 2+ kinds each ("caminar por el Centro" ~ "caminar por la ciudad amurallada").
  // Not [cafe] vs [bookstore, cafe]: books aren't cafés.
  if (!sx && !sy) return same || (Math.min(px.length, py.length) >= 2 && jaccard(px, py) >= 0.66);
  if (sx && sy) return (same && x.kind === "food" && y.kind === "food") || (cross && (titleOfGenre(x, y) || titleOfGenre(y, x)));
  // One signal-less activity vs a genre/food with the same place kinds ("bailar salsa" ~ salsa). Two different artists never match this way.
  const withSignal = sx ? x : y;
  return same && withSignal.kind !== "title";
}

const joinLabels = (ls: TasteLabel[]): TasteLabel => {
  const j = (xs: string[], and: string) => (xs.length < 2 ? xs[0] : `${xs.slice(0, -1).join(", ")} ${and} ${xs.at(-1)}`);
  return { es: j(ls.map((l) => l.es), "y"), en: j(ls.map((l) => l.en), "and"), ...(ls[0].esArt != null && { esArt: ls[0].esArt }) };
};
const labelOf = (e: TasteEntity): TasteLabel => e.label ?? { es: e.input, en: e.input };

/** Folds near-duplicates of one person into one taste (keeps the one with a Qloo signal as the base). */
export function mergeDuplicates(found: TasteEntity[]): TasteEntity[] {
  const groups: TasteEntity[][] = [];
  for (const e of found) {
    const g = groups.find((g) => g.some((x) => sameTaste(x, e)));
    if (g) g.push(e);
    else groups.push([e]);
  }
  return groups.map((g) => {
    if (g.length === 1) return g[0];
    const base = g.find((x) => x.signal !== false && x.kind !== "activity") ?? g.find((x) => x.signal !== false) ?? g[0];
    const labels = g.map(labelOf);
    return {
      ...base,
      input: g.map((x) => x.input).join(", "),
      label: joinLabels(labels),
      merged: labels,
      places: [...new Set(g.flatMap((x) => x.places ?? []))],
    };
  });
}

/**
 * Pairs each taste with the other person's same-kind taste (sets `pair` on both sides) and
 * copies the Qloo signal onto a signal-less twin ("bailar salsa" gets the Salsa tag), so
 * shared tastes rank places the same way for both.
 */
export function pairTastes(a: TasteEntity[], b: TasteEntity[]): { a: TasteEntity[]; b: TasteEntity[] } {
  const na = a.map((e) => ({ ...e, pair: undefined as number | undefined }));
  const nb = b.map((e) => ({ ...e, pair: undefined as number | undefined }));
  const adopt = (to: TasteEntity, from: TasteEntity) => {
    if (to.signal === false && from.signal !== false) Object.assign(to, { id: from.id, name: from.name, type: from.type, signal: true, facts: to.facts ?? from.facts });
  };
  // Not exclusive: Diomedes Díaz and vallenato can both match the partner's vallenato.
  na.forEach((x) => {
    const j = nb.findIndex((y) => sameTaste(x, y, true));
    if (j >= 0) x.pair = j;
  });
  nb.forEach((y) => {
    const i = na.findIndex((x) => sameTaste(x, y, true));
    if (i >= 0) y.pair = i;
  });
  // Signal-less twins take the partner's Qloo signal so both rank places the same way.
  na.forEach((x) => x.pair != null && adopt(x, b[x.pair]));
  nb.forEach((y) => y.pair != null && adopt(y, a[y.pair]));
  const clean = (xs: typeof na) => xs.map(({ pair, ...e }) => (pair == null ? e : { ...e, pair }));
  return { a: clean(na), b: clean(nb) };
}
