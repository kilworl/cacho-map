import { describe, expect, it } from "vitest";
import { cleanLine, dedupeWords, fixPunctuation, fixSubjectComma, inLang, sanitizeRoast, tameAdjectives } from "./sanitize";

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
    expect(r.title).toBe("Riesgo de cacho: 70% · Getsemaní");
    expect(sanitizeRoast({ title: "Bad", roast: "x", plan: "y" }, 40, "en", "Manga").title).toBe("Cheating risk: 40% · Manga");
  });
  it("keeps a valid title", () => {
    expect(sanitizeRoast({ title: "Riesgo de cacho: 33% · cachos de película", roast: "x", plan: "y" }, 33, "es").title).toBe("Riesgo de cacho: 33% · cachos de película");
  });
  it("drops dark or violent sentences", () => {
    expect(cleanLine("Caro se tira por la ventana. Dani pide tacos.", 50)).toBe("Dani pide tacos.");
    expect(cleanLine("Dani would rather die than watch it. Caro picks the show.", 50)).toBe("Caro picks the show.");
    expect(cleanLine("A Caro le montaron los cachos con queso.", 50)).toBe("A Caro le montaron los cachos con queso.");
  });
});

describe("inLang", () => {
  it("detects a Spanish roast on an English request", () => {
    expect(inLang("Dani adora Harry Potter. Con ese 90% de riesgo, no es un prisionero, solo tiene otro plan.", "en")).toBe(false);
    expect(inLang("Caro loves The Mentalist, so none of Dani's alibis survive a Friday.", "en")).toBe(true);
  });
});

describe("punctuation and innuendo", () => {
  it("fixes double periods and spacing", () => {
    expect(fixPunctuation("Ana se fue.. y Leo ,  tranquilo .")).toBe("Ana se fue… y Leo, tranquilo.");
    expect(fixPunctuation("Plan:cine,luego tacos...Fin")).toBe("Plan: cine, luego tacos… Fin");
    expect(cleanLine("Leo se queda en casa. Ana se va...", 40)).toBe("Leo se queda en casa. Ana se va…");
  });
  it("drops sexual innuendo, including in the title", () => {
    expect(cleanLine("Ana ve Fast & Furious. Todo con final feliz.. para él.", 40)).toBe("Ana ve Fast & Furious.");
    expect(cleanLine("Leo wants sushi. Ana wants a happy ending.", 40)).toBe("Leo wants sushi.");
    expect(sanitizeRoast({ title: "Riesgo de cacho: 40% · final feliz para él.", roast: "x y z.", plan: "" }, 40, "es", "Getsemaní").title).toBe("Riesgo de cacho: 40% · Getsemaní");
    expect(sanitizeRoast({ title: "Riesgo de cacho: 40% · cada quien su plan.", roast: "x", plan: "" }, 40, "es").title).toBe("Riesgo de cacho: 40% · cada quien su plan");
  });
});

describe("title cleanup", () => {
  it("drops an empty trailing segment and keeps quotes tight", () => {
    expect(sanitizeRoast({ title: "Riesgo de cacho: 40% · Comida para uno ·  ", roast: "Ana sale sola a comer tacos y Leo ni se entera.", plan: "" }, 40, "es").title).toBe("Riesgo de cacho: 40% · Comida para uno");
    expect(fixPunctuation("un 'creep,' de verdad")).toBe("un 'creep,' de verdad");
  });
});

describe("inLang guard", () => {
  it("catches the Spanish plan Jesús saw in EN mode", () => {
    const es = "Podrían ir a Juan Valdez en Crespo, donde a ambos les gusta el café, y así disfrutan juntos de una tarde tranquila en Cartagena.";
    expect(inLang(es, "en")).toBe(false);
    expect(inLang(es, "es")).toBe(true);
    expect(inLang("They could grab coffee at Juan Valdez in Crespo and enjoy a quiet afternoon together.", "en")).toBe(true);
    expect(inLang("They could grab coffee at Juan Valdez in Crespo and enjoy a quiet afternoon together.", "es")).toBe(false);
    expect(inLang("Gimnasio", "es")).toBe(true);
    expect(inLang("Modern movie theater complex offering mainstream film screenings.", "es")).toBe(false);
  });
});

describe("v8 text fixes", () => {
  it("drops the comma between subject and verb, keeps it after a subordinate clause", () => {
    expect(fixSubjectComma("A Andrés le gusta Attack on Titan: cada salida a Rezak Bar Club sin Valentina, es un ataque.")).toBe("A Andrés le gusta Attack on Titan: cada salida a Rezak Bar Club sin Valentina es un ataque.");
    expect(fixSubjectComma("Si Mateo sale solo, es peligro.")).toBe("Si Mateo sale solo, es peligro.");
  });
  it("dedupes repeated lowercase words but not names", () => {
    expect(dedupeWords("restaurantes restaurantes de mariscos")).toBe("restaurantes de mariscos");
    expect(dedupeWords("Bora Bora Beach")).toBe("Bora Bora Beach");
  });
  it("removes vibes the data doesn't back", () => {
    expect(tameAdjectives("Plan: un rato tranquilo y romántico en Bar Tu Candela.", "es")).toBe("Plan: un rato en Bar Tu Candela.");
    expect(tameAdjectives("Grab drinks at an amazing rooftop.", "en")).toBe("Grab drinks at a rooftop.");
  });
});
