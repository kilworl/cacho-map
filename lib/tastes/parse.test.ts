import { describe, expect, it } from "vitest";
import { heuristicParse } from "./parse";

describe("heuristicParse", () => {
  it("splits natural sentences into atomic tastes", () => {
    const r = heuristicParse("Me gusta Lana del Rey, el mentalista, películas de acción y las motos, el gym y ver anime");
    expect(r.map((x) => x.input)).toEqual(["Lana del Rey", "mentalista", "películas de acción", "motos", "gym", "anime"]);
    expect(r.find((x) => x.input === "gym")?.places).toEqual(["gym"]);
    expect(r.find((x) => x.input === "motos")?.kind).toBe("activity");
  });
  it("handles the other person's list", () => {
    const r = heuristicParse("vallenato, fresas con crema, kdramas, la playa y BTS");
    expect(r.map((x) => x.label.en)).toEqual(["vallenato", "strawberries and cream", "K-dramas", "beach", "BTS"]);
    expect(r.find((x) => x.input === "kdramas")?.query).toBe("K-drama");
  });
});
