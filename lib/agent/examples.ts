import type { Lang } from "../types";

/**
 * Curated bank of good cacho jokes (made-up couples). Each request gets a rotating
 * sample of 3 that don't mention the couple's own tastes, so outputs can't copy them.
 * `keys` are lowercase fragments of the taste each joke is built on.
 */
export interface Shot {
  keys: string[];
  hook: string;
  es: string;
  en: string;
}

export const SHOTS: Shot[] = [
  { keys: ["shakira"], hook: "Shakira → \"las mujeres ya no lloran, facturan\"", es: "A Laura le gusta Shakira: si le montan los cachos, ya sabe que no se llora, se factura.", en: "Laura loves Shakira: if anyone cheats on her, she won't cry, she'll invoice." },
  { keys: ["lost"], hook: "Lost → perdido", es: "Andrés ve Lost. Los sábados no está perdido: está en otro plan.", en: "Andrés watches Lost. On Saturdays he isn't lost: he's at another plan." },
  { keys: ["sherlock"], hook: "Sherlock → descubre todo", es: "Laura lee Sherlock Holmes: a Andrés no le alcanza ninguna coartada para los viernes.", en: "Laura reads Sherlock Holmes: none of Andrés's Friday alibis survive." },
  { keys: ["harry potter", "potter"], hook: "Harry Potter → capa de invisibilidad", es: "Mateo ama Harry Potter: no sale con otra gente, simplemente se pone la capa y nadie lo ve en todo el sábado.", en: "Mateo loves Harry Potter: he doesn't go out with others, he just puts on the cloak and vanishes every Saturday." },
  { keys: ["superhero", "superhéroe", "marvel", "batman", "spider"], hook: "superhéroes → identidad secreta", es: "A Sofi le encantan los superhéroes: de día es su novia, de noche tiene una identidad secreta en el bar de enfrente.", en: "Sofi loves superheroes: girlfriend by day, secret identity at the bar across the street by night." },
  { keys: ["taylor swift", "swift"], hook: "Taylor Swift → canciones de despecho", es: "A Juli le gusta Taylor Swift: si le pegan cacho, mínimo sale un álbum.", en: "Juli loves Taylor Swift: cheat on her and, worst case, we get an album." },
  { keys: ["bad bunny"], hook: "Bad Bunny → \"Me porto bonito\"", es: "A Vale le gusta Bad Bunny: dice que se porta bonito, pero los viernes perrea sin Simón.", en: "Vale loves Bad Bunny: she swears she'll behave, but on Fridays she dances without Simón." },
  { keys: ["la casa de papel", "money heist"], hook: "La casa de papel → el plan perfecto", es: "Simón ve La casa de papel: cada salida sin Vale tiene un plan, un profesor y cero testigos.", en: "Simón watches Money Heist: every night out without Vale has a plan, a Professor and zero witnesses." },
  { keys: ["sushi", "japanese"], hook: "sushi → rollos", es: "A Nico le encanta el sushi: con tanto rollo por fuera, ya nadie sabe con quién come.", en: "Nico loves sushi: with that many rolls on the side, nobody knows who he's eating with." },
  { keys: ["café", "coffee"], hook: "café → \"solo un tinto\"", es: "Pao vive en los cafés: siempre es \"solo un tinto\", y vuelve a las tres horas.", en: "Pao lives in cafés: it's always \"just one coffee\", and she's back three hours later." },
  { keys: ["mexican", "mexicana", "tacos"], hook: "comida mexicana → cachos con queso (quesadilla)", es: "A Tomi le gusta la comida mexicana: el cacho no es con otra persona, es con queso y en tortilla.", en: "Tomi loves Mexican food: he's not cheating with a person, he's cheating with a quesadilla." },
  { keys: ["friends"], hook: "Friends → \"estábamos en un break\"", es: "Lu ve Friends: si la pillan, ya tiene la excusa lista, \"estábamos en un break\".", en: "Lu watches Friends: if she's caught, the excuse is ready: \"we were on a break\"." },
  { keys: ["fútbol", "football", "soccer"], hook: "fútbol → jugar de visitante", es: "Andrés es de fútbol: los domingos juega de visitante, y no precisamente en el estadio.", en: "Andrés is into football: on Sundays he plays away games, and not at the stadium." },
  { keys: ["stranger things"], hook: "Stranger Things → el Upside Down", es: "Pipe ve Stranger Things: cuando desaparece, no está en el Upside Down, está en otro plan.", en: "Pipe watches Stranger Things: when he disappears, he's not in the Upside Down, he's at another plan." },
];

/** 3 rotating examples that don't touch the couple's own tastes. */
export function pickShots(tastes: string[], lang: Lang, n = 3, rand = Math.random): string[] {
  const own = tastes.join(" | ").toLowerCase();
  const pool = SHOTS.filter((s) => !s.keys.some((k) => own.includes(k)));
  const shuffled = [...pool].sort(() => rand() - 0.5);
  return shuffled.slice(0, n).map((s) => `- (${s.hook}) "${lang === "es" ? s.es : s.en}"`);
}
