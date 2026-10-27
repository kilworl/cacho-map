import { describe, expect, it } from "vitest";
import { fixGender, fixTastePossessives } from "./gender";

const caro = (pronoun: "m" | "f" | "n") => ({ nick: "Caro", pronoun });
const dani = (pronoun: "m" | "f" | "n") => ({ nick: "Dani", pronoun });

describe("fixGender", () => {
  it("fixes solo/sola to the person's pronoun", () => {
    expect(fixGender("Caro iría solo a Sr Miyagi.", [caro("f"), dani("m")], "es")).toBe("Caro iría sola a Sr Miyagi.");
    expect(fixGender("Dani iría sola a The Tub.", [caro("f"), dani("m")], "es")).toBe("Dani iría solo a The Tub.");
  });
  it("uses a neutral phrasing for elle", () => {
    expect(fixGender("Caro se iría sola a Doña Lola.", [caro("n"), dani("n")], "es")).toBe("Caro se iría sin compañía a Doña Lola.");
  });
  it("follows a pronoun closer than any name", () => {
    expect(fixGender("Andrés se pregunta qué pasa cuando ella sale solo al parque.", [{ nick: "Laura", pronoun: "f" }, { nick: "Andrés", pronoun: "m" }], "es")).toBe("Andrés se pregunta qué pasa cuando ella sale sola al parque.");
  });
  it("handles infinitives", () => {
    expect(fixGender("Si a Dani se le ocurre salir solo, ojo.", [caro("f"), dani("n")], "es")).toBe("Si a Dani se le ocurre salir sin compañía, ojo.");
  });
  it("keeps the adverb solo (only)", () => {
    expect(fixGender("Caro solo quiere tacos.", [caro("n"), dani("n")], "es")).toBe("Caro solo quiere tacos.");
  });
  it("drops sentences with pronouns nobody uses", () => {
    expect(fixGender("A Caro le gusta Lost. Ella se pierde.", [caro("n"), dani("m")], "es")).toBe("A Caro le gusta Lost.");
    expect(fixGender("Caro loves Lost. His cover is blown.", [caro("f"), dani("n")], "en")).toBe("Caro loves Lost.");
  });
  it("drops gendered adjectives for neutral people, fixes them otherwise", () => {
    expect(fixGender("Dani está enamorada. Caro paga.", [caro("n"), dani("n")], "es")).toBe("Caro paga.");
    expect(fixGender("Dani está enamorada.", [caro("n"), dani("m")], "es")).toBe("Dani está enamorado.");
    expect(fixGender("Dani sale sin Caro, de seguro hay canción.", [caro("f"), dani("n")], "es")).toBe("Dani sale sin Caro, de seguro hay canción.");
  });
});

describe("fixTastePossessives", () => {
  it("rewrites wrong his/her before a taste to the owner's name", () => {
    const ana = { nick: "Ana", pronoun: "f" as const, tastes: ["Friends", "salsa"] };
    const leo = { nick: "Leo", pronoun: "m" as const, tastes: ["gym", "Metallica"] };
    expect(fixTastePossessives("Her gym is not a person", [ana, leo], "en")).toBe("Leo's gym is not a person");
    expect(fixTastePossessives("His Friends binge is the alibi", [ana, leo], "en")).toBe("Ana's Friends binge is the alibi");
  });
  it("leaves Spanish alone and ignores non-taste nouns", () => {
    const leo = { nick: "Leo", pronoun: "m" as const, tastes: ["gym"] };
    expect(fixTastePossessives("Su gym no es persona", [leo], "es")).toBe("Su gym no es persona");
    expect(fixTastePossessives("Her plan fell apart", [leo], "en")).toBe("Her plan fell apart");
  });
});
