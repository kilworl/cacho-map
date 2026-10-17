import { describe, expect, it } from "vitest";
import { templatePlace, templateZone } from "./enrich";
import { judgeTotal } from "./roast";
import type { Pin, ZoneStat } from "../types";

const zone = (over: Partial<ZoneStat>): ZoneStat => ({
  zone: "Getsemaní", lat: 0, lon: 0, riskPct: 100, kind: "danger", n: 3, both: 0, a: 2, b: 1,
  onlyA: { name: "Doña Lola" }, onlyB: { name: "Alquímico" },
  profile: { genres: ["Restaurant", "Bar"], cuisines: ["Seafood"], ambience: ["Lively", "Unmappedvibe"], avgPrice: 2 },
  ...over,
});
const ctx = { a: "Caro", b: "Dani", tastesA: [], tastesB: [], lang: "es" as const };

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

describe("judgeTotal", () => {
  it("drops incoherent or unsafe candidates", () => {
    expect(judgeTotal({ index: 0, coherence: 2, wordplay: 5, funny: 5, safe: 5 })).toBe(-1);
    expect(judgeTotal({ index: 0, coherence: 5, wordplay: 5, funny: 5, safe: 3 })).toBe(-1);
    expect(judgeTotal({ index: 0, coherence: 4, wordplay: 3, funny: 2, safe: 5 })).toBe(23);
  });
});
