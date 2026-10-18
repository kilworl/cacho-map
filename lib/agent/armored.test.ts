import { describe, expect, it } from "vitest";
import { fallbackRoast, sharedPairs } from "./fallback";
import { checkJoke } from "./ownership";
import { pctChain } from "../explain";
import type { MatchResult, ScoreResult, TasteEntity } from "../types";

const lina = { nick: "Lina", pronoun: "f" as const };
const mateo = { nick: "Mateo", pronoun: "m" as const };
const base: ScoreResult = { risk: 5, rawRisk: 0, level: "armored", onlyA: 0, onlyB: 0, totalA: 20, totalB: 20, shared: 20, tagScore: 0, tasteRisk: 0, placeRisk: 0, pairedA: 2, pairedB: 2, pins: [], zones: [], topTags: [] };
const ent = (label: string, pair: number): TasteEntity => ({ id: label, name: label, type: "tag", input: label, label: { es: label, en: label }, pair });

describe("pareja blindada (armored)", () => {
  it("fallback goes for 'ni el cacho los separa' and names shared tastes next to their owners", () => {
    const shared = sharedPairs([ent("salsa", 0), ent("comida de mar", 1)], ["la salsa", "la comida de mar"], ["la salsa", "el ceviche y los mariscos"]);
    expect(shared).toEqual([["la salsa", "la salsa"], ["la comida de mar", "el ceviche y los mariscos"]]);
    const es = fallbackRoast(lina, mateo, base, "es", ["la salsa", "la comida de mar"], ["la salsa", "el ceviche y los mariscos"], shared);
    expect(es.title).toBe("Riesgo de cacho: 5% · Ni el cacho los separa");
    expect(es.roast).toBe("A los dos les gusta la salsa: con gustos tan parecidos, ni el cacho los separa. Si alguno sale, es con el otro.");
    const en = fallbackRoast(lina, mateo, base, "en", ["salsa"], ["salsa dancing"], [["salsa", "salsa dancing"]]);
    expect(en.title).toBe("Cheating risk: 5% · Not even a cacho can split them");
    expect(en.roast).toMatch(/^Lina is into salsa and Mateo into salsa dancing: .*not even a cacho can split them/);
  });
  it("the fallback passes the ownership check", () => {
    const ctx = (lang: "es" | "en") => ({
      a: { nick: "Lina", tastes: [ent("salsa", 0), ent("comida de mar", 1)], shown: lang === "es" ? ["la salsa", "la comida de mar"] : ["salsa", "seafood"] },
      b: { nick: "Mateo", tastes: [ent("salsa", 0), ent("ceviche y mariscos", 1)], shown: lang === "es" ? ["la salsa", "el ceviche y los mariscos"] : ["salsa", "ceviche and shellfish"] },
      vocab: ["Cartagena"],
    });
    for (const [lang, sh] of [["es", [["la comida de mar", "el ceviche y los mariscos"]]], ["en", [["seafood", "ceviche and shellfish"]]], ["es", [["la salsa", "la salsa"]]]] as const) {
      const c = ctx(lang);
      const f = fallbackRoast(lina, mateo, base, lang, c.a.shown, c.b.shown, sh.map((x) => [...x]) as [string, string][]);
      expect(checkJoke(f.title, f.roast, c).ok, f.roast).toBe(true);
    }
  });
  it("the % sentence says the 5% is a floor and gives the real number", () => {
    const r = { ...base, a: "Lina", b: "Mateo", lang: "es", tastesA: [ent("salsa", 0)], tastesB: [ent("salsa", 0)], missingA: [], missingB: [] } as unknown as MatchResult;
    expect(pctChain(r, "es")).toMatch(/^El 5% es el mínimo: en Cacho-Map nadie está 100% a salvo\. Sin ese mínimo sería 0%/);
    expect(pctChain(r, "en")).toMatch(/^5% is the minimum: on Cacho-Map nobody is 100% safe\. Without it, it would be 0%/);
    expect(pctChain({ ...r, risk: 40, rawRisk: 40, level: "medium" }, "es")).toMatch(/^40% = promedio de dos partes/);
  });
});
