import { describe, expect, it } from "vitest";
import { checkAttribution, checkJoke, checkReferences, type OwnershipCtx } from "./ownership";
import type { TasteEntity } from "../types";

const E = (name: string, type = "artist", input = name, extra: Partial<TasteEntity> = {}): TasteEntity => ({ id: name, name, type, input, ...extra });
const ctx: OwnershipCtx = {
  a: {
    nick: "Ana",
    tastes: [
      E("Karol G", "artist", "Karol G", { facts: "Colombian singer and songwriter known for her reggaeton and Latin trap music." }),
      E("Fast & Furious", "movie", "Fast & Furious", { akas: ["Rápido y furioso"] }),
      E("Mexican Street Food", "tag", "comida mexicana"),
    ],
  },
  b: {
    nick: "Leo",
    tastes: [E("Radiohead", "artist", "Radiohead", { facts: "Radiohead is an English rock band known for their innovative and experimental approach to music." }), E("Amélie", "movie", "Amélie", { akas: ["Le Fabuleux Destin d'Amélie Poulain"] }), E("Sushi", "tag", "sushi")],
  },
  vocab: ["Sr Miyagi", "Getsemaní", "Cartagena", "Café del Mar"],
};

describe("checkAttribution", () => {
  it("accepts tastes credited to their owner", () => {
    expect(checkAttribution("A Ana le gusta Fast & Furious y a Leo Amélie.", ctx).ok).toBe(true);
    expect(checkAttribution("Leo pone Radiohead mientras Ana ve Rápido y furioso.", ctx).ok).toBe(true);
    expect(checkAttribution("Ana's Karol G playlist and Leo's Radiohead never meet.", ctx).ok).toBe(true);
  });
  it("rejects a taste credited to the other person", () => {
    const r = checkAttribution("Leo ve Fast & Furious para escaparse rápido.", ctx);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Fast & Furious.*Leo.*Ana/);
    expect(checkAttribution("Leo is into Fast and Furious, so he leaves fast.", ctx).ok).toBe(false);
    expect(checkAttribution("Ana pone Radiohead a todo volumen.", ctx).ok).toBe(false);
  });
  it("respects an explicit owner after the mention", () => {
    expect(checkAttribution("Leo aguanta Fast & Furious de Ana.", ctx).ok).toBe(true);
  });
});

describe("checkReferences", () => {
  it("rejects songs/albums/coined names not in Qloo data", () => {
    expect(checkReferences("Ana pasó de Motomami a Motoajena.", ctx).ok).toBe(false);
    expect(checkReferences("Ana canta Bichota y Leo llora con Creep.", ctx).ok).toBe(false);
  });
  it("allows tastes, akas, description words, places and sentence-initial common words", () => {
    expect(checkReferences("Mientras Ana perrea con Karol G en Getsemaní, Leo come sushi en Sr Miyagi.", ctx).ok).toBe(true);
    expect(checkReferences("Ojo, Leo: el Destin de Amélie es otro plan.", ctx).ok).toBe(true);
    expect(checkReferences("Ana's reggaeton nights are Colombian, Leo's are English rock.", ctx).ok).toBe(true);
  });
});

describe("checkJoke", () => {
  it("checks the title punchline too", () => {
    expect(checkJoke("Riesgo de cacho: 40% · De Motomami a Motoajena", "A Ana le gusta Karol G y a Leo Radiohead, cada quien por su lado.", ctx).ok).toBe(false);
    expect(checkJoke("Riesgo de cacho: 40% · cada quien con su plan", "A Ana le gusta Karol G y a Leo Radiohead, cada quien por su lado.", ctx).ok).toBe(true);
  });
});

describe("checkReferences edge cases", () => {
  it("allows a lone capitalized first word and common starters, trims quotes", () => {
    expect(checkJoke("Riesgo de cacho: 40% · Viaje rápido, sin avisar", "A Ana le gusta Fast & Furious.", ctx).ok).toBe(true);
    expect(checkReferences("Ana loves Karol G. Sometimes she goes out alone. He never notices.", ctx).ok).toBe(true);
    const r = checkReferences("Leo is a 'Creep' on the side.", ctx);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unknown reference "Creep"');
    expect(checkReferences("Leo pone No Surprises en Getsemaní.", ctx).ok).toBe(false);
  });
});
