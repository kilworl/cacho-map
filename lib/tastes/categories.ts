import type { EntityType, TasteQuery } from "../types";

/**
 * Deterministic fallback when the LLM normalizer is unavailable:
 * common Spanish/English generic categories -> English Qloo tag query.
 */
export const CATEGORY_SYNONYMS: Record<string, string> = {
  videojuegos: "video games", "video juegos": "video games", juegos: "video games", gaming: "video games", "video games": "video games",
  superheroes: "superheroes", superhéroes: "superheroes", marvel: "superheroes", dc: "superheroes",
  anime: "anime", manga: "manga", "k-pop": "k-pop", kpop: "k-pop", doramas: "k-drama", "k-drama": "k-drama",
  reggaeton: "reggaeton", reguetón: "reggaeton", reggaetón: "reggaeton", salsa: "salsa", vallenato: "vallenato", champeta: "champeta",
  rock: "rock", metal: "heavy metal", pop: "pop", jazz: "jazz", electrónica: "electronic", electronica: "electronic", rap: "hip hop", trap: "trap",
  terror: "horror", "películas de terror": "horror", horror: "horror", comedia: "comedy", romance: "romance", "ciencia ficción": "science fiction",
  documentales: "documentary", "true crime": "true crime", fútbol: "soccer", futbol: "soccer", deportes: "sports",
  sushi: "sushi", pizza: "pizza", hamburguesas: "burgers", "comida mexicana": "mexican", "comida italiana": "italian",
  "comida callejera": "street food", "comida de mar": "seafood", mariscos: "seafood", café: "coffee", cafe: "coffee", vino: "wine", cerveza: "beer",
  playa: "beach", lectura: "books", libros: "books", fantasía: "fantasy", fantasia: "fantasy",
};

const strip = (s: string) => s.toLocaleLowerCase("es").normalize("NFD").replace(/\p{M}/gu, "").trim();
const INDEX = new Map(Object.entries(CATEGORY_SYNONYMS).map(([k, v]) => [strip(k), v]));

/** Heuristic normalization: known categories become tag queries, everything else is a title search. */
export function heuristicNormalize(input: string): TasteQuery {
  const cat = INDEX.get(strip(input));
  return cat ? { input, kind: "category", query: cat } : { input, kind: "title", query: input };
}

export const ENTITY_TYPES: EntityType[] = ["artist", "movie", "tv_show", "book", "videogame", "podcast", "place", "brand"];
