import { describe, expect, it } from "vitest";
import { fitsTaste, tasteTopics } from "./fit";

describe("fitsTaste", () => {
  it("keeps cafés out of supermarkets and seafood restaurants", () => {
    const none = tasteTopics("café coffee");
    expect(fitsTaste({ name: "Carulla Bocagrande", genres: ["Supermarket", "Coffee shop"] }, ["cafe"], none)).toBe(false);
    expect(fitsTaste({ name: "Buena Vida Marisquería", genres: ["Seafood restaurant", "Coffee shop"] }, ["cafe"], none)).toBe(false);
    expect(fitsTaste({ name: "Época Café", genres: ["Coffee shop", "Cafe"] }, ["cafe"], none)).toBe(true);
  });
  it("UFC doesn't bring baseball or football stadiums", () => {
    const ufc = tasteTopics("peleas UFC mixed martial arts");
    expect(fitsTaste({ name: "Estadio de Béisbol Once de Noviembre", genres: ["Stadium", "Baseball"] }, ["sports_bar", "stadium"], ufc)).toBe(false);
    expect(fitsTaste({ name: "Estadio de Futbol Jaime Morón", genres: ["Stadium"] }, ["sports_bar", "stadium"], ufc)).toBe(false);
    expect(fitsTaste({ name: "La Esquina Sports Bar", genres: ["Sports bar"] }, ["sports_bar"], ufc)).toBe(true);
  });
  it("artist bars prefer venues of the artist's genre", () => {
    const metallica = tasteTopics("Metallica American heavy metal band");
    expect(fitsTaste({ name: "Donde Fidel Salsa Bar", genres: ["Bar"] }, ["live_music", "bar"], metallica)).toBe(false);
    expect(fitsTaste({ name: "Rock Hard Bar", genres: ["Bar"] }, ["live_music", "bar"], metallica)).toBe(true);
    expect(fitsTaste({ name: "The Clock Pub", genres: ["Bar"] }, ["live_music", "bar"], metallica)).toBe(true);
    // A taste with no genre words isn't filtered by genre.
    expect(fitsTaste({ name: "Donde Fidel Salsa Bar", genres: ["Bar"] }, ["bar"], tasteTopics("El mentalista"))).toBe(true);
  });
});

describe("malls", () => {
  it("a mall isn't a gym", () => {
    expect(fitsTaste({ name: "Centro Comercial Nao", genres: ["Shopping mall", "Gym"] }, ["gym"], tasteTopics("gym"))).toBe(false);
    expect(fitsTaste({ name: "Bodytech Caribe Plaza", genres: ["Gym", "Shopping mall"] }, ["gym"], tasteTopics("gym"))).toBe(true);
  });
});

describe("matched kinds", () => {
  it("a seafood place with a coffee tag isn't a café for a book lover", () => {
    const p = { name: "Buena Vida Marisquería", genres: ["Seafood restaurant", "Coffee shop"], tagIds: ["urn:tag:genre:place:restaurant:seafood", "urn:tag:genre:place:restaurant:coffee_shop"] };
    expect(fitsTaste(p, ["bookstore", "cafe"], tasteTopics("novels"))).toBe(false);
    expect(fitsTaste(p, ["seafood"], tasteTopics("seafood"))).toBe(true);
  });
});
