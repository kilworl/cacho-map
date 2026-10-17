import { describe, expect, it } from "vitest";
import { templatePlace, templateZone } from "./enrich";
import { passes, pickBest, type Verdict } from "./roast";
import type { Pin, ZoneStat } from "../types";

const zone = (over: Partial<ZoneStat>): ZoneStat => ({
  zone: "Getsemaní", lat: 0, lon: 0, riskPct: 100, kind: "danger", n: 3, both: 0, a: 2, b: 1,
  onlyA: { name: "Doña Lola" }, onlyB: { name: "Alquímico" },
  profile: { genres: ["Restaurant", "Bar"], cuisines: ["Seafood"], ambience: ["Lively", "Unmappedvibe"], avgPrice: 2 },
  ...over,
});
const ctx = { a: "Caro", b: "Dani", pa: { nick: "Caro", pronoun: "f" as const }, pb: { nick: "Dani", pronoun: "n" as const }, tastesA: [], tastesB: [], lang: "es" as const };

describe("templateZone", () => {
  it("describes a zone only from its Qloo profile, never showing untranslated tags in Spanish", () => {
    const t = templateZone(zone({}), ctx);
    expect(t.description).toBe("Zona de restaurantes y bares, ambiente animado (según Qloo), precios $$.");
    expect(t.why).toContain("Caro vendría a Doña Lola y Dani a Alquímico");
  });
  it("explains safe zones", () => {
    expect(templateZone(zone({ kind: "safe", both: 2, n: 3 }), { ...ctx, lang: "en" }).why).toMatch(/^Safe zone: 2 of 3/);
  });
});

describe("templatePlace", () => {
  it("builds a plan from the place type", () => {
    const p = { id: "1", name: "Sr Miyagi", lat: 0, lon: 0, who: "a", zone: "Bocagrande", genre: "Sushi restaurant" } as Pin;
    expect(templatePlace(p, "es").plan).toBe("Plan: comer sushi en Sr Miyagi.");
  });
});

const v = (index: number, over: Partial<Verdict> = {}): Verdict => ({
  index, makes_sense: true, wordplay: true, punchline_at_end: true, no_contradiction: true, safe: true, funny: 3, ...over,
});

describe("judge selection", () => {
  it("rejects candidates failing any criterion or below the funny threshold", () => {
    expect(passes(v(0))).toBe(true);
    expect(passes(v(0, { wordplay: false }))).toBe(false);
    expect(passes(v(0, { no_contradiction: false }))).toBe(false);
    expect(passes(v(0, { funny: 2 }))).toBe(false);
  });
  it("picks the funniest passing candidate, ranking breaks ties", () => {
    const c = ["x", "y", "z"];
    expect(pickBest(c, [v(0, { funny: 4 }), v(1, { funny: 5, makes_sense: false }), v(2, { funny: 4 })], [2, 0, 1]).best).toBe("z");
    expect(pickBest(c, [v(0, { funny: 2 }), v(1, { safe: false }), v(2, { wordplay: false })], [0, 1, 2]).best).toBeNull();
  });
  it("falls back to the first candidate if the judge is down", () => {
    expect(pickBest(["x", "y"], null, null).best).toBe("x");
  });
});
