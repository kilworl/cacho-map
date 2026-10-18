/**
 * Couple-level checks of the risk formula (taste part + plan part) on realistic shapes:
 * a similar couple must land low, opposite couples high — even when Qloo's ranked lists
 * for the "same" taste differ, and opposite tastes share some generic bars.
 */
import { describe, expect, it } from "vitest";
import { favoritePlaces, type InputKind } from "./blend";
import { DEEP_PLACES, score, TOP_PLACES } from "./score";
import { mergeDuplicates, pairTastes } from "../tastes/dedupe";
import type { TasteEntity, ZonedPlace } from "../types";

const P = (id: string): ZonedPlace => ({ id, name: id, lat: 10.4, lon: -75.5, affinity: 1, zone: id[0] });
const range = (p: string, from: number, to: number) => Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => P(`${p}${from <= to ? from + i : from - i}`));
const tag = (id: string, en: string, es: string, kind: TasteEntity["kind"], places: string[]): TasteEntity =>
  ({ id, name: en, type: "tag", input: es, kind, label: { es, en }, places, signal: true });
const act = (en: string, es: string, places: string[]): TasteEntity =>
  ({ id: `place:${places.join("+")}`, name: en, type: "place_kind", input: es, kind: "activity", label: { es, en }, places, signal: false });
const artist = (id: string, name: string, facts: string, places: string[]): TasteEntity =>
  ({ id, name, type: "artist", input: name, kind: "title", label: { es: name, en: name }, places, signal: true, facts });

/** Runs the real pipeline pieces: merge -> pair -> blend per-taste lists -> score. */
function run(ta: TasteEntity[], tb: TasteEntity[], lists: (e: TasteEntity) => ZonedPlace[]) {
  const p = pairTastes(mergeDuplicates(ta), mergeDuplicates(tb));
  const inputs = (ts: TasteEntity[]) => ts.map((e) => ({ kind: "typed" as InputKind, places: lists(e) }));
  const fav = favoritePlaces(inputs(p.a), inputs(p.b), TOP_PLACES, undefined, DEEP_PLACES);
  return score([], fav.a.slice(0, TOP_PLACES) as ZonedPlace[], fav.b.slice(0, TOP_PLACES) as ZonedPlace[], { deepA: fav.a, deepB: fav.b, tastesA: p.a, tastesB: p.b });
}

const SALSA = ["salsa_bar", "night_club", "live_music"];

describe("similar couple (Lina x Mateo)", () => {
  it("scores below 35% even though Qloo ranks their 'same' tastes differently", () => {
    const lina = [
      tag("urn:tag:genre:music:salsa", "salsa", "salsa", "genre", SALSA),
      tag("urn:tag:cuisine:seafood", "seafood", "comida de mar", "food", ["seafood"]),
      tag("urn:tag:genre:media:true_crime", "True Crime", "true crime", "genre", ["cinema", "bookstore", "escape_room"]),
      act("walking downtown", "caminar por el Centro", ["park", "attraction"]),
    ];
    const mateo = [
      act("salsa dancing", "bailar salsa", SALSA),
      tag("urn:tag:cuisine:ceviche", "ceviche", "ceviche", "food", ["seafood"]),
      tag("urn:tag:cuisine:shellfish", "shellfish", "mariscos", "food", ["seafood"]),
      { ...artist("urn:entity:mam", "Making a Murderer", "American true crime documentary series", ["cinema", "bookstore", "escape_room"]), type: "tv_show" },
      act("walking the walled city", "caminar por la ciudad amurallada", ["park", "attraction"]),
    ];
    const lists = (e: TasteEntity): ZonedPlace[] => {
      if (e.places?.includes("salsa_bar")) return range("S", 1, 15);
      if (e.id.includes("seafood")) return range("F", 1, 15);
      if (e.id.includes("ceviche")) return range("F", 20, 6); // different order and some other restaurants
      if (e.id.includes("shellfish")) return range("F", 25, 10);
      if (e.id.includes("true_crime")) return range("C", 1, 12);
      if (e.id.includes("mam")) return range("C", 8, 20);
      return range("W", 1, 8);
    };
    const r = run(lina, mateo, lists);
    expect(r.risk).toBeLessThan(35);
    // A perfect match shows the 5% floor and the "pareja blindada" level.
    expect(r.risk).toBeGreaterThanOrEqual(5);
    if (r.rawRisk! <= 10) expect(r.level).toBe("armored");
    expect(r.pairedA).toBe(4);
    expect(r.pairedB).toBe(4); // ceviche + mariscos folded into one
  });
});

describe("opposite couples", () => {
  it("metalero gym/anime vs reggaeton/beach/brunch: >= 60% even with some shared bars", () => {
    const andres = [
      artist("urn:entity:metallica", "Metallica", "American heavy metal band", ["live_music", "bar"]),
      tag("urn:tag:genre:music:metal", "metal", "metal", "genre", ["live_music", "bar"]),
      act("gym", "gym", ["gym"]),
      tag("urn:tag:genre:media:anime", "anime", "anime", "genre", ["cinema", "video_games"]),
    ];
    const vale = [
      tag("urn:tag:genre:music:reggaeton", "reggaeton", "reguetón", "genre", ["night_club", "live_music"]),
      artist("urn:entity:karolg", "Karol G", "Colombian reggaeton singer", ["night_club", "live_music"]),
      act("beach", "la playa", ["beach"]),
      act("brunch", "brunch", ["brunch"]),
      tag("urn:tag:cuisine:sushi", "sushi", "sushi", "food", ["sushi"]),
    ];
    const lists = (e: TasteEntity): ZonedPlace[] => {
      switch (e.label!.en) {
        case "Metallica": return [...range("B", 1, 8), ...range("L", 1, 6)]; // bars + live music
        case "metal": return [...range("B", 3, 10), ...range("L", 4, 9)];
        case "gym": return range("G", 1, 6);
        case "anime": return range("K", 1, 6);
        case "reggaeton": return [...range("N", 1, 10), ...range("L", 5, 8)]; // shares some live-music venues
        case "Karol G": return [...range("N", 3, 12), ...range("B", 7, 9)];
        case "beach": return range("Y", 1, 8);
        case "brunch": return range("R", 1, 8);
        default: return range("U", 1, 8);
      }
    };
    const r = run(andres, vale, lists);
    expect(r.risk).toBeGreaterThanOrEqual(60);
    expect(r.pairedA).toBe(0);
  });
  it("bookworm vs party animal and vegan yoga vs carnívoro: >= 60%", () => {
    const camila = [tag("t:cafe", "cafés", "cafés", "food", ["cafe"]), tag("t:jazz", "jazz", "jazz", "genre", ["live_music", "bar"]), tag("t:novel", "novels", "novelas", "genre", ["bookstore", "cafe"]), act("museums", "museos", ["museum"])];
    const brayan = [tag("t:champeta", "champeta", "champeta", "genre", ["night_club", "bar"]), act("nightclubs", "discotecas", ["night_club"]), tag("t:football", "football", "fútbol", "genre", ["sports_bar", "stadium"]), tag("t:beer", "beer", "cerveza", "food", ["bar"])];
    const lists = (e: TasteEntity): ZonedPlace[] => {
      const k = e.places![0];
      const shared = k === "bar" || k === "live_music" ? range("B", 1, 4) : []; // generic bars both get
      return [...range(k.slice(0, 2).toUpperCase(), 1, 10), ...shared];
    };
    expect(run(camila, brayan, lists).risk).toBeGreaterThanOrEqual(60);
    const sam = [tag("t:vegan", "vegan", "vegano", "food", ["vegan"]), tag("t:folk", "indie folk", "indie folk", "genre", ["live_music", "bar"]), tag("t:tea", "tea", "té", "food", ["tea", "cafe"])];
    const jorge = [tag("t:bbq", "barbecue", "asados", "food", ["steakhouse"]), tag("t:vallenato", "vallenato", "vallenato", "genre", ["night_club", "bar"]), act("UFC fights", "peleas de la UFC", ["sports_bar"])];
    expect(run(sam, jorge, lists).risk).toBeGreaterThanOrEqual(60);
  });
});
