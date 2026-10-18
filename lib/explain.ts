import type { Lang, MatchResult, Pin, TasteEntity, ZoneStat } from "./types";
import { dictionaries, type Calc } from "./i18n/dict";
import { DEEP_PLACES } from "./scoring/score";
import { isPlaceKind, placeKindLabel } from "./places/catalog";
import { placeType, specificTypes } from "./i18n/placeTypes";

/**
 * Plain-language "why" for every place, zone and the % itself, built from the
 * attribution chain: taste -> its own Qloo place list -> blended top 20 -> zone.
 * Pure and deterministic, rendered in whatever language the UI is in.
 */

export const list = (xs: string[], lang: Lang) => {
  const and = dictionaries[lang].andWord;
  return xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${and} ${xs.at(-1)}`;
};

/** Taste name in the UI language; `art` adds the Spanish article ("el anime"). */
export function tasteName(e: TasteEntity | undefined, lang: Lang, art = false): string {
  if (!e) return "";
  if (lang === "es") return (art ? e.label?.esArt : undefined) ?? e.label?.es ?? e.input;
  return e.label?.en ?? e.name;
}

const names = (idx: number[] | undefined, tastes: TasteEntity[], lang: Lang, art = false, n = 2) =>
  list([...new Set((idx ?? []).slice(0, n).map((i) => tasteName(tastes[i], lang, art)).filter(Boolean))], lang);

/** "Por esto: le sale a Jesús por su gusto por el anime." */
export function placeWhy(p: Pin, r: MatchResult, lang: Lang): string {
  const t = dictionaries[lang];
  const ta = names(p.fromA, r.tastesA, lang, true);
  const tb = names(p.fromB, r.tastesB, lang, true);
  const general = (idx: number[] | undefined, tastes: TasteEntity[], s: string) =>
    idx?.length && tastes[idx[0]]?.placeMode === "general" ? t.fansOf(s) : s;
  // Shared via a same-kind taste: the place is on one person's list, the other has the twin taste.
  if (p.who === "both" && p.via && ta && tb)
    return p.via === "a" ? t.placeWhyPair(r.a, general(p.fromA, r.tastesA, ta), r.b, tb) : t.placeWhyPair(r.b, general(p.fromB, r.tastesB, tb), r.a, ta);
  if (p.who === "both" && ta && tb) return t.placeWhyBoth(r.a, general(p.fromA, r.tastesA, ta), r.b, general(p.fromB, r.tastesB, tb));
  if (p.who === "a" && ta) return t.placeWhyOne(r.a, general(p.fromA, r.tastesA, ta));
  if (p.who === "b" && tb) return t.placeWhyOne(r.b, general(p.fromB, r.tastesB, tb));
  return "";
}

/** Localized place kinds of a zone ("bares y cafés"), from its Qloo place genres. */
export function zoneTypes(z: ZoneStat, lang: Lang): string {
  const types = specificTypes(z.profile.genres.map((g) => placeType(g, lang)).filter((x) => x && (x.known || lang === "en")).map((x) => x!.plural)).slice(0, 2);
  return list(types, lang);
}

/** Top tastes of a person overall (by how many of their places they brought). */
function topTastes(pins: Pin[], key: "fromA" | "fromB", tastes: TasteEntity[], lang: Lang, n = 2, art = false): string {
  const m = new Map<number, number>();
  for (const p of pins) { const i = p[key]?.[0]; if (i != null) m.set(i, (m.get(i) ?? 0) + 1); }
  const idx = [...m].sort((x, y) => y[1] - x[1]).map(([i]) => i);
  return names(idx.length ? idx : tastes.map((_, i) => i), tastes, lang, art, n);
}

/** "Getsemaní: bares y cafés. Aquí le salen planes por los gustos de Karol (vallenato, BTS) y casi nada por los de Jesús (acción, anime) → Karol iría sin Jesús." */
export function zoneWhy(z: ZoneStat, r: MatchResult, lang: Lang): string {
  const t = dictionaries[lang];
  const types = zoneTypes(z, lang);
  const here = (by: [number, number][] | undefined, tastes: TasteEntity[]) => names(by?.map(([i]) => i), tastes, lang, true);
  const bare = (by: [number, number][] | undefined, tastes: TasteEntity[]) => names(by?.map(([i]) => i), tastes, lang);
  const ta = here(z.byA, r.tastesA);
  const tb = here(z.byB, r.tastesB);
  const nA = z.a + z.both;
  const nB = z.b + z.both;
  if (z.kind === "safe") return t.zoneWhySafe(z.zone, types, r.a, ta || "—", r.b, tb || "—");
  // One-sided: one person gets at least twice the plans the other does here.
  if (nB >= 2 && nA * 2 <= nB) return t.zoneWhyOneSided(z.zone, types, r.b, bare(z.byB, r.tastesB), r.a, topTastes(r.pins, "fromA", r.tastesA, lang));
  if (nA >= 2 && nB * 2 <= nA) return t.zoneWhyOneSided(z.zone, types, r.a, bare(z.byA, r.tastesA), r.b, topTastes(r.pins, "fromB", r.tastesB, lang));
  return t.zoneWhySplit(z.zone, types, r.a, ta || "—", r.b, tb || "—");
}

/** Numbers + names behind the % (shared by the % sentence and the "how is it calculated" panel). */
export function calc(r: MatchResult, lang: Lang): Calc {
  const solo = (who: "a" | "b") => topTastes(r.pins.filter((p) => p.who === who), who === "a" ? "fromA" : "fromB", who === "a" ? r.tastesA : r.tastesB, lang, 2, true);
  const pairs = r.tastesA.flatMap((e) => {
    const o = e.pair != null ? r.tastesB[e.pair] : undefined;
    if (!o) return [];
    const x = tasteName(e, lang);
    const y = tasteName(o, lang);
    return [x.toLowerCase() === y.toLowerCase() ? x : `${x} ↔ ${y}`];
  });
  return {
    a: r.a, b: r.b, risk: r.risk, totalA: r.totalA, onlyA: r.onlyA, totalB: r.totalB, onlyB: r.onlyB,
    whyA: r.onlyA ? solo("a") : "", whyB: r.onlyB ? solo("b") : "",
    sharedTastes: pairs.slice(0, 3).join(", "),
    tasteRisk: r.tasteRisk, placeRisk: r.placeRisk, rawRisk: r.rawRisk,
    nA: r.tastesA.length, nB: r.tastesB.length, pairedA: r.pairedA ?? 0, pairedB: r.pairedB ?? 0,
    tags: r.topTags.length > 0, deep: DEEP_PLACES,
  };
}

/** The % in plain words: taste part + plan part, naming the tastes behind each side's solo plans. */
export function pctChain(r: MatchResult, lang: Lang): string {
  return dictionaries[lang].pctChain(calc(r, lang));
}

/** Per-taste breakdown for the "how is it calculated" panel. */
export function breakdown(r: MatchResult, lang: Lang): { title: string; lines: string[] }[] {
  const t = dictionaries[lang];
  return (["a", "b"] as const).map((side) => {
    const key = side === "a" ? "fromA" : "fromB";
    const tastes = side === "a" ? r.tastesA : r.tastesB;
    const mine = r.pins.filter((p) => p[key]?.length);
    const lines = tastes.map((e, i) => {
      const ps = mine.filter((p) => p[key]![0] === i);
      const kinds = (e.places ?? []).filter(isPlaceKind).map((k) => placeKindLabel(k, lang));
      const how = e.placeMode === "typed" && kinds.length ? t.viaPlaces(list(kinds, lang)) : t.viaGeneral;
      return t.breakdownLine(tasteName(e, lang), ps.length, ps.filter((p) => p.who === "both").length, how);
    });
    return { title: t.breakdownTitle(side === "a" ? r.a : r.b, side === "a" ? r.totalA : r.totalB), lines };
  });
}
