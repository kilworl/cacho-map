import { describe, expect, it } from "vitest";
import { cleanLine, sanitizeRoast } from "./sanitize";

describe("cleanLine", () => {
  it("drops sentences quoting zone percentages but keeps the overall one", () => {
    expect(cleanLine("62% de cachos y Radiohead. En Manga no coinciden en 80% de lugares. Fin.", 62)).toBe("62% de cachos y Radiohead. Fin.");
  });
  it("removes corny openers and exclamations", () => {
    expect(cleanLine("¡Ay, qué pareja! Ella pone Karol G.", 50)).toBe("Qué pareja. Ella pone Karol G.");
  });
  it("drops slang tacked on at the end", () => {
    expect(cleanLine("Son dos emisoras con la señal cruzada, eche.", 10)).toBe("Son dos emisoras con la señal cruzada.");
  });
  it("handles decomposed accents", () => {
    expect(cleanLine("Un rave en el mismo parlante, aja\u0301.", 10)).toBe("Un rave en el mismo parlante.");
  });
  it("drops chained trailing slang", () => {
    expect(cleanLine("Él cree que fue un bug. Ajá, qué nota.", 10)).toBe("Él cree que fue un bug.");
  });
  it("drops filler slang openers", () => {
    expect(cleanLine("Majo quiere Billie. Eche, no son pareja.", 10)).toBe("Majo quiere Billie. No son pareja.");
  });
  it("drops probability talk", () => {
    expect(cleanLine("Hay probabilidad de pelea. Eche.", 10)).toBe("Eche.");
  });
});

describe("sanitizeRoast", () => {
  it("forces the overall % label at the start of the title", () => {
    const r = sanitizeRoast({ title: "Zona roja · Getsemaní", roast: "x", plan: "y" }, 70, "es");
    expect(r.title).toBe("70% de cachos · Getsemaní");
    expect(sanitizeRoast({ title: "Bad", roast: "x", plan: "y" }, 40, "en", "Manga").title).toBe("40% taste-cheating · Manga");
  });
  it("keeps a valid title", () => {
    expect(sanitizeRoast({ title: "33% de cachos · paz armada", roast: "x", plan: "y" }, 33, "es").title).toBe("33% de cachos · paz armada");
  });
});
