/** Shared domain types. Kept framework-free so they can be used by server, client and tests. */
/** Pronoun chosen per person: él/he, ella/she, neutral (elle/they). */
export type Pronoun = "m" | "f" | "n";

export type Lang = "es" | "en";
export type Who = "both" | "a" | "b";

export interface GeoPoint {
  lat: number;
  lon: number;
}

/** Where the couple is. Places and zones are computed around this point. */
export interface CityContext extends GeoPoint {
  name: string;
  country?: string;
}

/** Kind of thing a person typed: a specific title/artist, or a general category ("videojuegos"). */
export type EntityType = "artist" | "movie" | "tv_show" | "book" | "videogame" | "podcast" | "place" | "brand";

/** A free-text taste after normalization (before hitting Qloo). */
export interface TasteQuery {
  input: string;
  kind: "title" | "category";
  /** Canonical English title or category name used to query Qloo. */
  query: string;
  type?: EntityType;
}

export interface TasteLabel {
  es: string;
  en: string;
  esArt?: string;
}

/** What kind of thing an atomic taste is: a specific title, a genre, a food, or a lifestyle activity. */
export type TasteKind = "title" | "genre" | "food" | "activity";

/** One atomic taste split out of a person's free text ("me gusta el gym y ver anime" -> gym, anime). */
export interface ParsedTaste {
  /** The words as the person wrote them. */
  input: string;
  /** Display label in both languages ("películas de acción" / "action movies"); esArt adds the Spanish article ("las películas de acción"). */
  label: TasteLabel;
  kind: TasteKind;
  /** Canonical English Qloo query ("Action", "The Mentalist", "K-drama"). */
  query: string;
  /** Other English queries to try ("desserts" for "strawberries and cream"). */
  alt?: string[];
  type?: EntityType;
  /** Which Qloo tag family fits a genre/food: media, music or food. */
  domain?: "media" | "music" | "food";
  /** Place kinds a fan would obviously go to because of this taste (lib/places/catalog). */
  places: string[];
}

/** A taste we couldn't use, shown crossed out with the reason. */
export interface MissingTaste {
  input: string;
  label?: { es: string; en: string };
  /** no_match: Qloo found nothing; low_confidence: Qloo's best match was something else; no_places: no such places nearby. */
  reason: "no_match" | "low_confidence" | "no_places";
  /** What Qloo returned when we rejected it as a wrong match ("40k"). */
  got?: string;
}

/** A taste Qloo understood: an entity (urn:entity:…) or a tag (urn:tag:…) for categories. */
export interface TasteEntity {
  id: string;
  name: string;
  /** Entity type ("tv_show", "movie"…) or "tag" for categories. */
  type: string;
  /** What the person actually typed. */
  input: string;
  /** Alternate titles from Qloo (Latin script). */
  akas?: string[];
  /** Qloo short description / description text. */
  facts?: string;
  kind?: TasteKind;
  label?: TasteLabel;
  /** False for lifestyle tastes understood only as place kinds (no Qloo taste entity). */
  signal?: boolean;
  /** Place kinds used to find this taste's places. */
  places?: string[];
  /** How its places were found: "typed" = Qloo places of those kinds ranked for this taste; "general" = Qloo's places for fans of it. */
  placeMode?: "typed" | "general";
  /** How many Qloo places this taste brought (before blending). */
  placeCount?: number;
  /** Near-duplicate tastes of the same person folded into this one ("ceviche" + "mariscos"). */
  merged?: TasteLabel[];
  /** Index of the other person's taste that is the same kind of thing (shared taste), if any. */
  pair?: number;
}

export interface ResolvedTastes {
  found: TasteEntity[];
  missing: MissingTaste[];
}

/** Descriptive Qloo tags of a place (all from Qloo data, in English). */
export interface PlaceTags {
  genres: string[];
  cuisines: string[];
  ambience: string[];
  activities: string[];
}

/** A Qloo place recommendation, normalized. */
export interface Place extends GeoPoint {
  id: string;
  name: string;
  affinity: number;
  neighborhood?: string;
  genre?: string;
  rating?: number;
  priceLevel?: number;
  image?: string;
  /** Qloo's short description (English). */
  description?: string;
  tags?: PlaceTags;
  /** Indices of the person's tastes whose Qloo list brought this place, strongest first. */
  from?: number[];
}

/** A Place after we assigned it to a zone (neighborhood). */
export interface ZonedPlace extends Place {
  zone: string;
}

export interface SharedTag {
  name: string;
  score: number;
  a: string[];
  b: string[];
}

export interface Pin extends GeoPoint {
  id: string;
  name: string;
  who: Who;
  zone: string;
  genre?: string;
  rating?: number;
  image?: string;
  priceLevel?: number;
  description?: string;
  tags?: PlaceTags;
  /** Localized one-liner: what the place is (LLM-phrased from Qloo data). */
  summary?: string;
  /** Localized one-line plan: what you'd do there. */
  plan?: string;
  /** Which of A's / B's tastes (indices into tastesA / tastesB) produced this place, strongest first. */
  fromA?: number[];
  fromB?: number[];
  /** "both" because the other has the same kind of taste; names whose Qloo list the place came from. */
  via?: "a" | "b";
  /** Client-side, in the UI language: why this place shows up, and its kind. */
  why?: string;
  typeLabel?: string;
}

/** A place that explains a zone clash: only one of them would pick it. */
export interface ZoneExample {
  name: string;
  genre?: string;
}

/** Facts about a zone aggregated from its Qloo places (no LLM). */
export interface ZoneProfile {
  genres: string[];
  cuisines: string[];
  ambience: string[];
  avgPrice?: number;
}

export interface ZoneStat extends GeoPoint {
  zone: string;
  onlyA?: ZoneExample;
  onlyB?: ZoneExample;
  /** % of this zone's places that only one of them likes (where one would go alone). */
  riskPct: number;
  /** "danger" = mostly one-sided places, "safe" = places they'd enjoy together. */
  kind: "danger" | "safe";
  n: number;
  both: number;
  a: number;
  b: number;
  profile: ZoneProfile;
  /** Localized characterization of the zone, phrased from `profile`. */
  description?: string;
  /** Localized reason why it's risky/safe for this couple. */
  why?: string;
  /** [taste index, number of this zone's places it produced] for A and B, most first. */
  byA?: [number, number][];
  byB?: [number, number][];
}

export type RiskLevel = "armored" | "low" | "medium" | "high" | "cheating";

export interface ScoreResult {
  /** Cheating risk: average of taste difference (tasteRisk) and separate plans (placeRisk); see lib/scoring/score.ts. */
  risk: number;
  level: RiskLevel;
  /** One-sided place counts and list sizes, to explain the number. */
  onlyA: number;
  onlyB: number;
  totalA: number;
  totalB: number;
  shared: number;
  /** Secondary: Qloo taste-tag affinity (0-100). */
  tagScore: number;
  /** Risk before the 5% floor (shown risk = max(5, rawRisk)). */
  rawRisk?: number;
  /** Risk parts (0-100): taste difference and share of plans the other wouldn't share. risk = average. */
  tasteRisk?: number;
  placeRisk?: number;
  /** How many of each person's tastes have a counterpart in the other's. */
  pairedA?: number;
  pairedB?: number;
  pins: Pin[];
  zones: ZoneStat[];
  topTags: SharedTag[];
}

export interface Roast {
  title: string;
  roast: string;
  plan: string;
}

export interface MatchResult extends ScoreResult {
  a: string;
  b: string;
  lang: Lang;
  city: CityContext;
  tastesA: TasteEntity[];
  tastesB: TasteEntity[];
  missingA: MissingTaste[];
  missingB: MissingTaste[];
  roast: Roast;
  agent: "llm" | "fallback";
  toolCalls: string[];
  /** Roast candidates with judge totals (-1 = dropped as nonsense/unsafe). */
  judged?: { title?: string; roast: string; total: number; dropped: boolean; reason?: string }[];
  pronounA?: Pronoun;
  pronounB?: Pronoun;
  /** How many "popular for anyone" places were left out of the comparison. */
  popularRemoved?: number;
  /** Whether the LLM or the heuristic split the free text into tastes. */
  parsedBy?: "llm" | "heuristic";
  timings: Record<string, number>;
}
