import { describe, expect, it } from "vitest";
import { matchConfidence } from "./match";

describe("matchConfidence", () => {
  it("rejects Qloo's wrong best guesses", () => {
    expect(matchConfidence("k-drama", "40k", { strict: true }).ok).toBe(false);
    expect(matchConfidence("kdramas", "40k", { strict: true }).ok).toBe(false);
    expect(matchConfidence("strawberries and cream", "Waffle With Strawberry And Ice Cream", { strict: true }).ok).toBe(false);
    expect(matchConfidence("action movies and motorcycles", "Action", { strict: true }).ok).toBe(false); // would silently lose "motos"
    expect(matchConfidence("motorcycles", "Action", { strict: true }).ok).toBe(false);
    expect(matchConfidence("K-drama", "Drama", { strict: true }).ok).toBe(false);
    expect(matchConfidence("The Mentalist", "The Simpsons").ok).toBe(false);
  });
  it("accepts real matches, plurals, typos and alternate titles", () => {
    expect(matchConfidence("K-drama", "K-Drama", { strict: true }).ok).toBe(true);
    expect(matchConfidence("kdramas", "Kdrama", { strict: true }).ok).toBe(true);
    expect(matchConfidence("desserts", "Desserts", { strict: true }).ok).toBe(true);
    expect(matchConfidence("action", "Action", { strict: true }).ok).toBe(true);
    expect(matchConfidence("The Mentalist", "The Mentalist").ok).toBe(true);
    expect(matchConfidence("Lana del Rey", "Lana Del Rey").ok).toBe(true);
    expect(matchConfidence("Fast & Furious", "The Fast and the Furious").ok).toBe(true);
    expect(matchConfidence("Rapido y furioso", "Fast & Furious", { akas: ["Rápido y furioso"] }).ok).toBe(true);
    expect(matchConfidence("Radiohed", "Radiohead").ok).toBe(true);
    expect(matchConfidence("BTS", "BTS").ok).toBe(true);
  });
});
