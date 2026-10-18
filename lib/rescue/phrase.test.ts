import { describe, expect, it } from "vitest";
import { acceptLine, templateLine } from "./phrase";
import type { RescueStop } from "../types";

const ctx = { a: { nick: "Jesús", pronoun: "m" as const }, b: { nick: "Karol", pronoun: "f" as const }, tastesA: [], tastesB: [], risk: 66 };
const stop: RescueStop = { id: "1", name: "Sr Miyagi", lat: 0, lon: 0, genre: "Sushi restaurant", forA: [0], forB: [], km: 1 };

describe("rescue plan copy", () => {
  it("keeps a short line in the right language", () => {
    expect(acceptLine("Pidan sushi para compartir y quédense para la música en vivo.", { ...ctx, lang: "es" })).toBeTruthy();
    expect(acceptLine("Prueben el ceviche, que a Ana le gusta el reguetón.", { ...ctx, lang: "es" })).toBeUndefined();
  });
  it("rejects wrong language, unsafe or too long lines", () => {
    expect(acceptLine("Share some sushi while Jesús tells Karol about his favorite anime.", { ...ctx, lang: "es" })).toBeUndefined();
    expect(acceptLine("Vayan al motel después de la cena.", { ...ctx, lang: "es" })).toBeUndefined();
    expect(acceptLine(Array(30).fill("sushi y salsa").join(" "), { ...ctx, lang: "es" })).toBeUndefined();
  });
  it("falls back to a template line from the place type, in each language", () => {
    expect(templateLine(stop, "es")).toBe("Comer sushi en Sr Miyagi.");
    expect(templateLine(stop, "en")).toMatch(/Sr Miyagi\.$/);
  });
});

describe("rescue lines that read as nonsense", () => {
  it("rejects 'X for A and Y for B' lines", () => {
    expect(acceptLine("Vayan al bar, pidan comida de pub para Jesús y algo de Karol G para Karol.", { ...ctx, lang: "es" })).toBeUndefined();
    expect(acceptLine("Catch a horror movie for Jesús and a K-drama for Karol.", { ...ctx, lang: "en" })).toBeUndefined();
    expect(acceptLine("Vean una de terror y después una de k-dramas: cada uno escoge la película.", { ...ctx, lang: "es" })).toBeTruthy();
  });
});
