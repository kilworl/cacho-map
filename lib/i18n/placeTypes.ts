import type { Lang } from "../types";

/** Spanish names + plan verbs for common Qloo place genres (deterministic fallback copy). */
const TYPES: [RegExp, string, string, string, string][] = [
  // pattern, ES plural, ES plan, EN plural, EN plan
  [/seafood/i, "restaurantes de mariscos", "comer mariscos", "seafood restaurants", "have seafood"],
  [/pizza/i, "pizzerías", "comer pizza", "pizza places", "grab pizza"],
  [/mexican/i, "restaurantes mexicanos", "comer tacos", "Mexican restaurants", "eat tacos"],
  [/sushi|japanese/i, "restaurantes japoneses", "comer sushi", "Japanese restaurants", "eat sushi"],
  [/ice cream|gelato|dessert/i, "heladerías y postres", "comer helado", "ice cream & dessert spots", "get ice cream"],
  [/bakery|pastry/i, "panaderías", "desayunar algo dulce", "bakeries", "grab a pastry"],
  [/coffee|caf[eé]/i, "cafés", "tomarse un café", "cafés", "have coffee"],
  [/cocktail|wine bar|pub|bar\b|brewery|lounge/i, "bares", "tomarse algo", "bars", "grab a drink"],
  [/night ?club|disco|dance/i, "discotecas", "salir a bailar", "nightclubs", "go dancing"],
  [/live music|music venue|concert/i, "sitios de música en vivo", "oír música en vivo", "live music venues", "catch live music"],
  [/restaurant|steak|grill|bistro|diner|food/i, "restaurantes", "cenar", "restaurants", "have dinner"],
  [/movie|cinema/i, "cines", "ver una película", "movie theaters", "watch a movie"],
  [/museum|gallery|art/i, "museos y galerías", "ver una exposición", "museums & galleries", "see an exhibit"],
  [/book/i, "librerías", "buscar un libro", "bookstores", "browse books"],
  [/game|arcade|bowling|escape/i, "sitios de juegos", "jugar algo", "game spots", "play some games"],
  [/beach/i, "playas", "ir a la playa", "beaches", "hit the beach"],
  [/park|garden|plaza|square/i, "parques y plazas", "caminar", "parks & squares", "go for a walk"],
  [/mall|shopping|store|market|shop/i, "tiendas y centros comerciales", "ir de compras", "shops & malls", "go shopping"],
  [/theat(er|re)/i, "teatros", "ver una obra", "theaters", "see a show"],
  [/church|cathedral|monument|fort|castle|historic|landmark/i, "sitios históricos", "conocer historia", "historic sites", "do some sightseeing"],
  [/hotel|hostel/i, "hoteles", "pasar la noche", "hotels", "stay over"],
  [/spa|gym|fitness|yoga/i, "sitios de bienestar", "relajarse", "wellness spots", "unwind"],
];

export function placeType(genre: string | undefined, lang: Lang): { plural: string; plan: string; known: boolean } | null {
  if (!genre) return null;
  const hit = TYPES.find(([re]) => re.test(genre));
  if (!hit) return lang === "es" ? { plural: genre.toLowerCase(), plan: "conocerlo", known: false } : { plural: genre.toLowerCase(), plan: "check it out", known: false };
  return lang === "es" ? { plural: hit[1], plan: hit[2], known: true } : { plural: hit[3], plan: hit[4], known: true };
}

const AMBIENCE_ES: Record<string, string> = {
  social: "social", lively: "animado", casual: "casual", cozy: "acogedor", quiet: "tranquilo", relaxing: "relajado",
  romantic: "romántico", elegant: "elegante", historic: "histórico", trendy: "de moda", upscale: "exclusivo",
  "family friendly": "familiar", welcoming: "acogedor", bohemian: "bohemio", charming: "encantador",
  sophisticated: "sofisticado", luxurious: "lujoso", stylish: "con estilo", traditional: "tradicional",
  touristic: "turístico", warm: "cálido", shady: "con sombra", modern: "moderno", vibrant: "vibrante",
  intimate: "íntimo", festive: "festivo", artsy: "artístico", hip: "de moda", grand: "imponente", clean: "limpio",
  "colonial vibe": "colonial", mainstream: "popular", convenient: "práctico", peaceful: "tranquilo", scenic: "con vista",
};

/** Ambience tag in the UI language; null when we have no Spanish for it (never show English in ES copy). */
export function ambience(tag: string, lang: Lang): string | null {
  const k = tag.toLowerCase();
  return lang === "en" ? k : AMBIENCE_ES[k] ?? null;
}

/** Qloo price level (1-4) as $ symbols. */
export const priceSigns = (p?: number) => (p ? "$".repeat(Math.max(1, Math.min(4, Math.round(p))))  : "");
