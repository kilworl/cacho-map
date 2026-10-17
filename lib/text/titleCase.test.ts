import { describe, expect, it } from "vitest";
import { normalizeName } from "./titleCase";

describe("normalizeName", () => {
  it.each([
    ["EIVISSA CARTAGENA", "Eivissa Cartagena"],
    ["DOÑA LOLA comida del caribe", "Doña Lola comida del caribe"],
    ["pueblito paisa", "Pueblito Paisa"],
    ["CASA DE LA PLAYA", "Casa de la Playa"],
    ["KFC Bocagrande", "KFC Bocagrande"],
    ["Café Havana", "Café Havana"],
  ])("%s -> %s", (input, out) => expect(normalizeName(input)).toBe(out));
});

describe("roman numerals", () => {
  it("keeps them uppercase", () => {
    expect(normalizeName("JUAN XXIII")).toBe("Juan XXIII");
    expect(normalizeName("Juan Xxiii")).toBe("Juan XXIII");
    expect(normalizeName("barrio pio xii")).toBe("Barrio Pio XII");
    expect(normalizeName("MI CASA")).toBe("Mi Casa");
  });
});
