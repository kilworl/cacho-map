import { describe, expect, it } from "vitest";
import { heuristicNormalize } from "./categories";

describe("heuristicNormalize", () => {
  it("maps Spanish categories to English tag queries", () => {
    expect(heuristicNormalize("Videojuegos")).toEqual({ input: "Videojuegos", kind: "category", query: "video games" });
    expect(heuristicNormalize("superhéroes")).toMatchObject({ kind: "category", query: "superheroes" });
    expect(heuristicNormalize("Comida mexicana")).toMatchObject({ kind: "category", query: "mexican" });
  });
  it("treats anything else as a title search", () => {
    expect(heuristicNormalize("Mentalista")).toEqual({ input: "Mentalista", kind: "title", query: "Mentalista" });
  });
});
