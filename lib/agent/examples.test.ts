import { describe, expect, it } from "vitest";
import { pickShots } from "./examples";

describe("pickShots", () => {
  it("never shows an example built on the couple's own tastes", () => {
    for (let i = 0; i < 20; i++) {
      const shots = pickShots(["Taylor Swift", "Harry Potter and the Prisoner of Azkaban", "Superheroes", "Mexican Street Food"], "es");
      expect(shots).toHaveLength(3);
      expect(shots.join(" ")).not.toMatch(/Taylor|Potter|superhéroes|mexicana/i);
    }
  });
  it("rotates", () => {
    const seen = new Set(Array.from({ length: 10 }, () => pickShots([], "en").join()));
    expect(seen.size).toBeGreaterThan(1);
  });
});
