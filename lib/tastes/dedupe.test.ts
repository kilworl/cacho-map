import { describe, expect, it } from "vitest";
import { mergeDuplicates, pairTastes } from "./dedupe";
import type { TasteEntity } from "../types";

const tag = (id: string, en: string, es: string, kind: TasteEntity["kind"], places: string[]): TasteEntity =>
  ({ id, name: en, type: "tag", input: es, kind, label: { es, en }, places, signal: true });
const act = (en: string, es: string, places: string[]): TasteEntity =>
  ({ id: `place:${places.join("+")}`, name: en, type: "place_kind", input: es, kind: "activity", label: { es, en }, places, signal: false });
const title = (id: string, name: string, facts: string, places: string[]): TasteEntity =>
  ({ id, name, type: "tv_show", input: name, kind: "title", label: { es: name, en: name }, places, signal: true, facts });

const SALSA = ["salsa_bar", "night_club", "live_music"];

describe("mergeDuplicates", () => {
  it("folds ceviche + mariscos + comida de mar into one seafood taste", () => {
    const m = mergeDuplicates([
      tag("urn:tag:cuisine:ceviche", "ceviche", "ceviche", "food", ["seafood"]),
      tag("urn:tag:cuisine:shellfish", "shellfish", "mariscos", "food", ["seafood"]),
      tag("urn:tag:cuisine:seafood", "seafood", "comida de mar", "food", ["seafood"]),
      tag("urn:tag:genre:music:salsa", "salsa", "salsa", "genre", SALSA),
    ]);
    expect(m).toHaveLength(2);
    expect(m[0].label?.es).toBe("ceviche, mariscos y comida de mar");
    expect(m[0].merged).toHaveLength(3);
  });
  it("folds 'salsa' and 'bailar salsa' (same genre places) and keeps the Qloo signal", () => {
    const m = mergeDuplicates([act("salsa dancing", "bailar salsa", SALSA), tag("urn:tag:genre:music:salsa", "salsa", "salsa", "genre", SALSA)]);
    expect(m).toHaveLength(1);
    expect(m[0].id).toBe("urn:tag:genre:music:salsa");
    expect(m[0].signal).toBe(true);
  });
  it("doesn't fold two different artists or genres that both lead to bars", () => {
    const m = mergeDuplicates([
      { ...title("urn:entity:metallica", "Metallica", "heavy metal band", ["live_music", "bar"]), type: "artist" },
      tag("urn:tag:genre:music:metal", "metal", "metal", "genre", ["live_music", "bar"]),
      tag("urn:tag:genre:music:vallenato", "vallenato", "vallenato", "genre", ["night_club", "bar"]),
    ]);
    expect(m).toHaveLength(3);
  });
});

describe("pairTastes", () => {
  it("'bailar salsa' gets the partner's Salsa signal; true crime matches a true crime show", () => {
    const lina = [tag("urn:tag:genre:music:salsa", "salsa", "salsa", "genre", SALSA), tag("urn:tag:genre:media:true_crime", "True Crime", "true crime", "genre", ["escape_room", "bookstore"])];
    const mateo = [act("salsa dancing", "bailar salsa", SALSA), title("urn:entity:mam", "Making a Murderer", "American true crime documentary series", ["escape_room", "bookstore"])];
    const p = pairTastes(lina, mateo);
    expect(p.a.map((e) => e.pair)).toEqual([0, 1]);
    expect(p.b.map((e) => e.pair)).toEqual([0, 1]);
    expect(p.b[0]).toMatchObject({ id: "urn:tag:genre:music:salsa", signal: true, label: { es: "bailar salsa" } });
  });
  it("opposite tastes don't pair", () => {
    const p = pairTastes([tag("urn:tag:genre:music:metal", "metal", "metal", "genre", ["live_music", "bar"])], [tag("urn:tag:genre:music:reggaeton", "reggaeton", "reguetón", "genre", ["night_club", "live_music"])]);
    expect(p.a[0].pair).toBeUndefined();
    expect(p.b[0].pair).toBeUndefined();
  });
});
