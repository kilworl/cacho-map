import { generateText, Output } from "ai";
import { z } from "zod";
import type { ParsedTaste, TasteKind } from "../types";
import { ENTITY_TYPES, CATEGORY_SYNONYMS } from "./categories";
import { PLACE_KIND_KEYS, isPlaceKind, type PlaceKind } from "../places/catalog";
import { modelId } from "../agent/model";

/** Max atomic tastes per person. */
export const MAX_TASTES = 8;

const Item = z.object({
  input: z.string().describe("the words as written, without 'me gusta'/'ver'/articles"),
  es: z.string().describe("short Spanish label, lowercase unless a proper name"),
  en: z.string().describe("short English label, lowercase unless a proper name"),
  es_art: z.string().describe("the Spanish label with its natural article: 'el anime', 'las películas de acción', 'el gym', 'la playa', 'los k-dramas'; names stay bare: 'BTS', 'Lana del Rey', 'El mentalista'"),
  kind: z.enum(["title", "genre", "food", "activity"]),
  query: z.string().describe("canonical English Qloo query"),
  alt: z.array(z.string()).max(2).optional(),
  type: z.enum(ENTITY_TYPES as [string, ...string[]]).optional(),
  domain: z.enum(["media", "music", "food"]).optional(),
  places: z.array(z.enum(PLACE_KIND_KEYS as [string, ...string[]])).max(3),
});
const Schema = z.object({ a: z.array(Item), b: z.array(Item) });

const SYSTEM = `You split what each person of a couple says they like into ATOMIC tastes for the Qloo taste API.
The text is free and natural ("Me gusta Lana del Rey, el mentalista, películas de acción y las motos, el gym y ver anime"). Split on commas AND on "y/and/e", and inside phrases with two things ("películas de acción y las motos" = 2 tastes). Drop filler ("me gusta", "ver", "el/la", "a X le gusta"). Never drop a taste, never invent one.
For each taste:
- kind "title": a specific artist, band, movie, TV show, book, game, podcast. query = official English/international name ("el mentalista" -> "The Mentalist", type tv_show; "Rápido y furioso" -> "Fast & Furious", type movie; "BTS" -> "BTS", type artist). Fix typos.
- kind "genre": a music/film/TV genre or theme ("vallenato" -> "Vallenato", domain music; "películas de acción" -> "Action", domain media; "kdramas"/"doramas" -> "K-drama", domain media; "anime" -> "Anime", domain media).
- kind "food": a food, dish or cuisine ("sushi" -> "Sushi", "comida mexicana" -> "Mexican", "fresas con crema" -> "Strawberries and cream", alt ["Desserts"]), domain food.
- kind "activity": a lifestyle thing done at places ("el gym" -> "Gym", "la playa" -> "Beach", "las motos" -> "Motorcycles", "bailar" -> "Dancing", "leer" -> "Books").
es/en/es_art: short display label in each language ("películas de acción"/"action movies", "k-dramas"/"K-dramas", "las motos" -> "motos"/"motorcycles", "fresas con crema"/"strawberries and cream"). Titles keep their name ("El mentalista"/"The Mentalist").
places: 0-3 place kinds a fan would OBVIOUSLY go to BECAUSE of this taste, from the allowed list only. Examples: action movies -> cinema, karting; anime -> cinema, video_games, comics; k-dramas -> korean, cinema; gym -> gym; beach -> beach; motorcycles -> motorcycle, karting; vallenato -> night_club, bar; reggaeton/BTS/pop artist -> night_club, live_music; rock/indie artist -> live_music, bar; sushi -> sushi; mexican -> mexican; strawberries and cream -> ice_cream, dessert; coffee -> cafe; books -> bookstore, cafe; detective/mystery shows -> escape_room, bookstore. Leave empty if nothing is obvious.`;

/** Generic labels read lowercase mid-sentence ("action movies", "gym"); names and "K-dramas" keep their capitals. */
const lower = (s: string) => s.trim();
const caseLabel = (s: string, kind: string) => (kind !== "title" && /^\p{Lu}\p{Ll}/u.test(s.trim()) ? s.trim().charAt(0).toLowerCase() + s.trim().slice(1) : s.trim());

/** One LLM call splits both people's free text into atomic tastes. Falls back to a heuristic split. */
export async function parseTastes(textA: string, textB: string, timeoutMs = 9000): Promise<{ a: ParsedTaste[]; b: ParsedTaste[]; llm: boolean }> {
  try {
    const res = await generateText({
      model: modelId(),
      system: SYSTEM,
      prompt: JSON.stringify({ a: textA, b: textB }),
      output: Output.object({ schema: Schema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(timeoutMs),
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    } as Parameters<typeof generateText>[0]);
    const out = (res as unknown as { output?: z.infer<typeof Schema> }).output;
    if (!out || (!out.a.length && textA.trim()) || (!out.b.length && textB.trim())) throw new Error("empty parse");
    const fix = (xs: z.infer<typeof Item>[]): ParsedTaste[] =>
      dedupe(xs.filter((x) => x.query.trim()).map((x) => ({
        input: lower(x.input || x.es).slice(0, 60),
        label: { es: caseLabel(x.es || x.input, x.kind).slice(0, 40), en: caseLabel(x.en || x.query, x.kind).slice(0, 40), esArt: caseLabel(x.es_art || x.es || x.input, x.kind).slice(0, 48) },
        kind: x.kind as TasteKind,
        query: x.query.slice(0, 80),
        ...(x.alt?.length && { alt: x.alt.slice(0, 2) }),
        ...(x.kind === "title" && x.type && { type: x.type as ParsedTaste["type"] }),
        ...(x.domain && { domain: x.domain }),
        places: x.places.filter(isPlaceKind),
      }))).slice(0, MAX_TASTES);
    return { a: fix(out.a), b: fix(out.b), llm: true };
  } catch (e) {
    console.warn("parse fallback:", (e as Error).message);
    return { a: heuristicParse(textA), b: heuristicParse(textB), llm: false };
  }
}

function dedupe(xs: ParsedTaste[]): ParsedTaste[] {
  const seen = new Set<string>();
  return xs.filter((x) => {
    const k = x.query.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const strip = (s: string) => s.toLocaleLowerCase("es").normalize("NFD").replace(/\p{M}/gu, "").trim();

/** Lifestyle and common tastes the heuristic knows: [es label, en label, kind, query, places, domain?]. */
const KNOWN: Record<string, [string, string, TasteKind, string, PlaceKind[], ParsedTaste["domain"]?]> = {
  gym: ["gym", "gym", "activity", "Gym", ["gym"]], gimnasio: ["gym", "gym", "activity", "Gym", ["gym"]],
  playa: ["playa", "beach", "activity", "Beach", ["beach"]], beach: ["playa", "beach", "activity", "Beach", ["beach"]],
  motos: ["motos", "motorcycles", "activity", "Motorcycles", ["motorcycle", "karting"]], motorcycles: ["motos", "motorcycles", "activity", "Motorcycles", ["motorcycle", "karting"]],
  bailar: ["bailar", "dancing", "activity", "Dancing", ["night_club"]], rumba: ["rumba", "partying", "activity", "Nightlife", ["night_club", "bar"]],
  anime: ["anime", "anime", "genre", "Anime", ["cinema", "video_games", "comics"], "media"],
  kdramas: ["k-dramas", "K-dramas", "genre", "K-drama", ["korean", "cinema"], "media"], doramas: ["k-dramas", "K-dramas", "genre", "K-drama", ["korean", "cinema"], "media"],
  "peliculas de accion": ["películas de acción", "action movies", "genre", "Action", ["cinema", "karting"], "media"], accion: ["acción", "action", "genre", "Action", ["cinema"], "media"],
  "fresas con crema": ["fresas con crema", "strawberries and cream", "food", "Desserts", ["ice_cream", "dessert"], "food"],
  cafe: ["café", "coffee", "food", "Coffee", ["cafe"], "food"], sushi: ["sushi", "sushi", "food", "Sushi", ["sushi"], "food"],
  "comida mexicana": ["comida mexicana", "Mexican food", "food", "Mexican", ["mexican"], "food"],
  vallenato: ["vallenato", "vallenato", "genre", "Vallenato", ["night_club", "bar"], "music"], salsa: ["salsa", "salsa", "genre", "Salsa", ["salsa_bar", "night_club"], "music"],
  videojuegos: ["videojuegos", "video games", "genre", "Video games", ["video_games"], "media"], libros: ["libros", "books", "activity", "Books", ["bookstore"]],
};

const ART: Record<string, string> = { gym: "el", playa: "la", motos: "las", bailar: "", rumba: "la", anime: "el", "k-dramas": "los", "películas de acción": "las", acción: "la", "fresas con crema": "las", café: "el", sushi: "el", "comida mexicana": "la", vallenato: "el", salsa: "la", videojuegos: "los", libros: "los" };

/** Deterministic split when the LLM is down: commas / "y" / "and", filler words removed. */
export function heuristicParse(text: string): ParsedTaste[] {
  const parts = text
    .replace(/\b(a \p{L}+ )?(me|le|nos|les) (gusta|gustan|encanta|encantan)\b/giu, ",")
    .replace(/\b(i|we|they|he|she) (like|love|enjoy)s?\b/gi, ",")
    .split(/[,;\n/]|\s+(?:y|e|and|o|or)\s+/i)
    .map((x) => x.replace(/^\s*(ver|escuchar|ir a|comer|jugar|watch(ing)?|listen(ing)? to|eat(ing)?|play(ing)?|go(ing)? to)\s+/i, "").replace(/^\s*(el|la|los|las|un|una|the)\s+/i, "").trim())
    .filter((x) => x.length > 1);
  return dedupe(parts.map((input): ParsedTaste => {
    const k = KNOWN[strip(input)];
    if (k) return { input, label: { es: k[0], en: k[1], esArt: ART[k[0]] ? `${ART[k[0]]} ${k[0]}` : k[0] }, kind: k[2], query: k[3], places: k[4], ...(k[5] && { domain: k[5] }) };
    const cat = CATEGORY_SYNONYMS[strip(input)];
    if (cat) return { input, label: { es: input, en: cat }, kind: "genre", query: cat, places: [] };
    return { input, label: { es: input, en: input }, kind: "title", query: input, places: [] };
  })).slice(0, MAX_TASTES);
}
