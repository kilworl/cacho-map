import { describe, expect, it } from "vitest";
import { favoritePlaces, inputWeights, popularBaseline, type InputList } from "./blend";
import { cheatingRisk } from "./score";

const P = (prefix: string, n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i + from}` }));
/** A list sharing `common` popular places first, then its own places. */
const list = (kind: InputList<{ id: string }>["kind"], own: string, common = 10) => ({ kind, places: [...P("pop", common), ...P(own, 40)] });
const risk = (a: InputList<{ id: string }>[], b: InputList<{ id: string }>[]) => {
  const f = favoritePlaces(a, b);
  return cheatingRisk(f.a.map((p) => p.id), f.b.map((p) => p.id)).risk;
};

describe("inputWeights", () => {
  it("weights titles over cuisines over categories and sums to 1", () => {
    const w = inputWeights(["title", "title", "cuisine", "category"]);
    expect(w.reduce((s, x) => s + x, 0)).toBeCloseTo(1);
    expect(w[0]).toBeGreaterThan(w[2]);
    expect(w[2]).toBeGreaterThan(w[3]);
  });
  it("caps any single input at 40% when there are 3+ inputs", () => {
    const w = inputWeights(["title", "category", "category", "category"]);
    expect(Math.max(...w)).toBeLessThanOrEqual(0.4 + 1e-9);
    expect(w.reduce((s, x) => s + x, 0)).toBeCloseTo(1);
  });
});

describe("popularBaseline", () => {
  it("flags places present in nearly every list", () => {
    const lists = [list("title", "a").places, list("title", "b").places, list("title", "c").places, list("title", "d").places];
    const base = popularBaseline(lists);
    expect(base.has("pop0")).toBe(true);
    expect(base.has("a0")).toBe(false);
  });
});

describe("stability", () => {
  // Caro: 3 titles + 1 category, Dani: 3 titles. Both share some titles' places.
  const shared = (k: InputList<{ id: string }>["kind"]) => list(k, "shared");
  const caro = [list("title", "mentalist"), list("title", "fast"), shared("title"), list("category", "games")];
  const dani = [list("title", "taylor"), list("title", "gilmore"), shared("title")];

  it("one added cuisine moves the risk by a bounded amount (≤ 20 points)", () => {
    const before = risk(caro, dani);
    const after = risk(caro, [...dani, list("cuisine", "mexican")]);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(20);
  });
  it("a cuisine fully overlapping the other person's taste also moves it by a bounded amount", () => {
    const before = risk(caro, dani);
    const after = risk(caro, [...dani, list("cuisine", "games")]);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(20);
  });
  it("drops popular-for-anyone places from the comparison", () => {
    const f = favoritePlaces(caro, dani);
    expect(f.generic).toContain("pop0");
    expect(f.a.some((p) => p.id.startsWith("pop"))).toBe(false);
  });
});
