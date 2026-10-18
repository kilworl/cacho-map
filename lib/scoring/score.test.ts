import { describe, expect, it } from "vitest";
import { buildPins, cheatingRisk, riskLevel, score, tagSimilarity, zoneStats } from "./score";
import type { SharedTag, ZonedPlace } from "../types";

const place = (id: string, zone: string, lat = 10, lon = -75): ZonedPlace => ({ id, name: id.toUpperCase(), lat, lon, affinity: 1, zone });
const tag = (s: number): SharedTag => ({ name: `t${s}`, score: s, a: [], b: [] });

describe("tagSimilarity", () => {
  it("is 0 without tags", () => expect(tagSimilarity([])).toBe(0));
  it("maps 0.5 to 0 and 0.73+ to 100 with full coverage", () => {
    expect(tagSimilarity(Array(40).fill(tag(0.5)))).toBe(0);
    expect(tagSimilarity(Array(40).fill(tag(0.8)))).toBe(100);
  });
});

describe("cheatingRisk", () => {
  it("is the average share of each person's places the other doesn't like", () => {
    // A likes 4 (1 shared -> 3/4 one-sided), B likes 2 (1 shared -> 1/2): (75 + 50) / 2
    expect(cheatingRisk(["s", "a1", "a2", "a3"], ["s", "b1"])).toEqual({ risk: 63, onlyA: 3, onlyB: 1, shared: 1 });
  });
  it("is 0 for identical lists and 100 for disjoint ones", () => {
    expect(cheatingRisk(["a", "b"], ["b", "a"]).risk).toBe(0);
    expect(cheatingRisk(["a"], ["b"]).risk).toBe(100);
  });
  it("levels", () => {
    expect([5, 10, 11, 40, 70, 90].map(riskLevel)).toEqual(["armored", "armored", "low", "medium", "high", "cheating"]);
  });
});

describe("buildPins / zoneStats", () => {
  const pa = [place("x", "Centro"), place("y", "Manga")];
  const pb = [place("x", "Centro"), place("z", "Centro")];
  const pins = buildPins(pa, pb);

  it("marks shared places as both and deduplicates", () => {
    expect(pins.map((p) => [p.id, p.who])).toEqual([["x", "both"], ["y", "a"], ["z", "b"]]);
  });
  it("computes per-zone risk, danger/safe kind and centroids", () => {
    const zones = zoneStats(pins);
    const centro = zones.find((z) => z.zone === "Centro")!;
    expect(centro).toMatchObject({ n: 2, both: 1, riskPct: 50, kind: "danger", lat: 10, lon: -75 });
    expect(zones.find((z) => z.zone === "Manga")).toMatchObject({ riskPct: 100, kind: "danger" });
    expect(centro.onlyB).toEqual({ name: "Z", genre: undefined });
    const safe = zoneStats(buildPins([place("q", "Bocagrande"), place("w", "Bocagrande")], [place("q", "Bocagrande"), place("w", "Bocagrande")]));
    expect(safe[0]).toMatchObject({ kind: "safe", riskPct: 0 });
  });
});

describe("score", () => {
  it("risk matches its definition", () => {
    // Identical lists: raw risk 0, shown as the 5% floor ("nobody is 100% safe").
    expect(score([], [place("a", "Z")], [place("a", "Z")])).toMatchObject({ risk: 5, rawRisk: 0, level: "armored", shared: 1 });
    const r = score([], [place("a", "Z")], [place("b", "Z")]);
    expect(r).toMatchObject({ risk: 100, level: "cheating", onlyA: 1, onlyB: 1 });
    expect(r.zones[0]).toMatchObject({ zone: "Z", riskPct: 100 });
  });
  it("only compares the top 20 places per person", () => {
    const many = Array.from({ length: 40 }, (_, i) => place(`p${i}`, "Z"));
    expect(score([], many, many).pins).toHaveLength(20);
  });
});
