import { describe, expect, it } from "vitest";
import { buildPins, placeOverlap, score, tagSimilarity, zoneStats } from "./score";
import type { SharedTag, ZonedPlace } from "../types";

const place = (id: string, zone: string, lat = 10, lon = -75): ZonedPlace => ({ id, name: id.toUpperCase(), lat, lon, affinity: 1, zone });
const tag = (s: number): SharedTag => ({ name: `t${s}`, score: s, a: [], b: [] });

describe("tagSimilarity", () => {
  it("is 0 without tags", () => expect(tagSimilarity([])).toBe(0));
  it("maps 0.5 to 0 and 0.73+ to 100 with full coverage", () => {
    expect(tagSimilarity(Array(40).fill(tag(0.5)))).toBe(0);
    expect(tagSimilarity(Array(40).fill(tag(0.8)))).toBe(100);
  });
  it("dampens results backed by few tags", () => {
    expect(tagSimilarity(Array(10).fill(tag(0.8)))).toBeCloseTo(25);
  });
});

describe("placeOverlap", () => {
  it("is Jaccard similarity", () => {
    expect(placeOverlap(["a", "b"], ["b", "c"])).toEqual({ score: (1 / 3) * 100, shared: 1 });
  });
  it("handles empty input", () => expect(placeOverlap([], [])).toEqual({ score: 0, shared: 0 }));
});

describe("buildPins / zoneStats", () => {
  const pa = [place("x", "Centro"), place("y", "Manga")];
  const pb = [place("x", "Centro"), place("z", "Centro")];
  const pins = buildPins(pa, pb);

  it("marks shared places as both and deduplicates", () => {
    expect(pins.map((p) => [p.id, p.who])).toEqual([["x", "both"], ["y", "a"], ["z", "b"]]);
  });
  it("computes per-zone disagreement and centroids", () => {
    const zones = zoneStats(pins);
    const centro = zones.find((z) => z.zone === "Centro")!;
    expect(centro).toMatchObject({ n: 2, both: 1, clashPct: 50, lat: 10, lon: -75 });
    expect(zones.find((z) => z.zone === "Manga")!.clashPct).toBe(100);
  });
});

describe("score", () => {
  it("weights tags 60% and places 40%, cachos = 100 - compat", () => {
    const r = score(Array(40).fill(tag(0.8)), [place("a", "Z")], [place("a", "Z")]);
    expect(r.compat).toBe(100);
    expect(r.cachos).toBe(0);
    const r2 = score([], [place("a", "Z")], [place("b", "Z")]);
    expect(r2.compat).toBe(0);
    expect(r2.cachos).toBe(100);
    expect(r2.zones[0]).toMatchObject({ zone: "Z", clashPct: 100 });
  });
  it("only compares the top 25 places per person", () => {
    const many = Array.from({ length: 40 }, (_, i) => place(`p${i}`, "Z"));
    expect(score([], many, many).pins).toHaveLength(25);
  });
});
