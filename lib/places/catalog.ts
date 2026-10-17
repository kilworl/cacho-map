import type { Lang } from "../types";

/**
 * Place kinds a taste can map to, with the Qloo place-genre tags that filter
 * /v2/insights to them (ids checked against Qloo's /v2/tags) and their labels.
 * "Ver anime" -> cinemas + video game stores; "el gym" -> gyms; "la playa" -> beaches.
 */
export const PLACE_KINDS = {
  cinema: { tags: ["movie_theater"], es: "cines", en: "movie theaters" },
  gym: { tags: ["gym"], es: "gimnasios", en: "gyms" },
  beach: { tags: ["beach", "beach_club"], es: "playas y clubes de playa", en: "beaches and beach clubs" },
  night_club: { tags: ["night_club", "dance_club"], es: "discotecas", en: "nightclubs" },
  bar: { tags: ["restaurant:bar", "restaurant:cocktail_bar"], es: "bares", en: "bars" },
  wine_bar: { tags: ["restaurant:wine_bar"], es: "bares de vino", en: "wine bars" },
  sports_bar: { tags: ["restaurant:sports_bar"], es: "bares deportivos", en: "sports bars" },
  live_music: { tags: ["live_music_venue", "restaurant:live_music_bar"], es: "sitios de música en vivo", en: "live music venues" },
  salsa_bar: { tags: ["restaurant:salsa_bar"], es: "bares de salsa", en: "salsa bars" },
  cafe: { tags: ["restaurant:coffee_shop", "restaurant:cafe"], es: "cafés", en: "cafés" },
  bakery: { tags: ["restaurant:bakery"], es: "panaderías", en: "bakeries" },
  ice_cream: { tags: ["restaurant:ice_cream_shop"], es: "heladerías", en: "ice cream shops" },
  dessert: { tags: ["restaurant:dessert_shop"], es: "postrerías", en: "dessert shops" },
  juice: { tags: ["restaurant:juice_shop"], es: "juguerías", en: "juice bars" },
  sushi: { tags: ["restaurant:sushi", "restaurant:japanese"], es: "restaurantes de sushi", en: "sushi restaurants" },
  korean: { tags: ["restaurant:korean", "restaurant:korean_barbecue"], es: "restaurantes coreanos", en: "Korean restaurants" },
  mexican: { tags: ["restaurant:mexican"], es: "restaurantes mexicanos", en: "Mexican restaurants" },
  seafood: { tags: ["restaurant:seafood"], es: "restaurantes de mariscos", en: "seafood restaurants" },
  pizza: { tags: ["restaurant:pizza"], es: "pizzerías", en: "pizza places" },
  burger: { tags: ["restaurant:hamburger"], es: "hamburgueserías", en: "burger joints" },
  italian: { tags: ["restaurant:italian"], es: "restaurantes italianos", en: "Italian restaurants" },
  chinese: { tags: ["restaurant:chinese"], es: "restaurantes chinos", en: "Chinese restaurants" },
  asian: { tags: ["restaurant:asian"], es: "restaurantes asiáticos", en: "Asian restaurants" },
  vegan: { tags: ["restaurant:vegan"], es: "restaurantes veganos", en: "vegan restaurants" },
  steakhouse: { tags: ["restaurant:steak_house"], es: "asaderos y parrillas", en: "steakhouses" },
  colombian: { tags: ["restaurant:colombian"], es: "restaurantes colombianos", en: "Colombian restaurants" },
  brunch: { tags: ["restaurant:brunch", "restaurant:breakfast"], es: "sitios de desayuno y brunch", en: "breakfast and brunch spots" },
  fast_food: { tags: ["restaurant:fast_food"], es: "comidas rápidas", en: "fast food" },
  tea: { tags: ["restaurant:tea_house"], es: "casas de té", en: "tea houses" },
  bookstore: { tags: ["book_store"], es: "librerías", en: "bookstores" },
  comics: { tags: ["comic_book_store"], es: "tiendas de cómics", en: "comic book stores" },
  video_games: { tags: ["video_game_store"], es: "tiendas de videojuegos", en: "video game stores" },
  music_store: { tags: ["music_store"], es: "tiendas de música", en: "music stores" },
  museum: { tags: ["museum"], es: "museos", en: "museums" },
  art_gallery: { tags: ["art_gallery"], es: "galerías de arte", en: "art galleries" },
  theater: { tags: ["performing_arts_theater", "concert_hall"], es: "teatros y salas de concierto", en: "theaters and concert halls" },
  park: { tags: ["park"], es: "parques", en: "parks" },
  mall: { tags: ["shopping_mall"], es: "centros comerciales", en: "shopping malls" },
  clothing: { tags: ["clothing_store"], es: "tiendas de ropa", en: "clothing stores" },
  electronics: { tags: ["electronics_store"], es: "tiendas de tecnología", en: "electronics stores" },
  market: { tags: ["market"], es: "mercados", en: "markets" },
  spa: { tags: ["spa"], es: "spas", en: "spas" },
  yoga: { tags: ["yoga_studio"], es: "estudios de yoga", en: "yoga studios" },
  pool: { tags: ["swimming_pool"], es: "piscinas", en: "swimming pools" },
  stadium: { tags: ["stadium"], es: "estadios", en: "stadiums" },
  bowling: { tags: ["bowling_alley"], es: "boleras", en: "bowling alleys" },
  karting: { tags: ["go_karting_venue"], es: "pistas de karts", en: "go-kart tracks" },
  amusement: { tags: ["amusement_park"], es: "parques de diversiones", en: "amusement parks" },
  escape_room: { tags: ["escape_room_center"], es: "escape rooms", en: "escape rooms" },
  hiking: { tags: ["hiking_area"], es: "rutas de caminata", en: "hiking areas" },
  golf: { tags: ["golf_course"], es: "campos de golf", en: "golf courses" },
  skate: { tags: ["skateboard_park"], es: "skateparks", en: "skate parks" },
  tattoo: { tags: ["tattoo_shop"], es: "estudios de tatuajes", en: "tattoo studios" },
  motorcycle: { tags: ["motorcycle_shop", "motorcycle_dealer"], es: "tiendas de motos", en: "motorcycle shops" },
  boat_tour: { tags: ["boat_tour_agency"], es: "paseos en lancha", en: "boat tours" },
  attraction: { tags: ["tourist_attraction"], es: "sitios turísticos", en: "tourist attractions" },
} as const satisfies Record<string, { tags: readonly string[]; es: string; en: string }>;

export type PlaceKind = keyof typeof PLACE_KINDS;
export const PLACE_KIND_KEYS = Object.keys(PLACE_KINDS) as PlaceKind[];

export const isPlaceKind = (k: string): k is PlaceKind => k in PLACE_KINDS;

/** Qloo tag ids for a set of place kinds (for filter.tags, OR semantics). */
export const placeKindTags = (kinds: readonly PlaceKind[]) => kinds.flatMap((k) => PLACE_KINDS[k].tags.map((t) => `urn:tag:genre:place:${t}`));

export const placeKindLabel = (k: PlaceKind, lang: Lang) => PLACE_KINDS[k][lang];

/** The place kind(s) of a Qloo place, from its genre tags (e.g. "Movie theater" -> cinema). */
export function kindsOfGenres(genres: string[] = []): PlaceKind[] {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const g = new Set(genres.map(slug));
  return PLACE_KIND_KEYS.filter((k) => PLACE_KINDS[k].tags.some((t) => g.has(t.replace(/^restaurant:/, ""))));
}
