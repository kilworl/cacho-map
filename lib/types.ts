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
export type EntityType = "artist" | "movie" | "tv_show" | "book" | "videogame" | "podcast" | "place";

/** A free-text taste after normalization (before hitting Qloo). */
export interface TasteQuery {
  input: string;
  kind: "title" | "category";
  /** Canonical English title or category name used to query Qloo. */
  query: string;
  type?: EntityType;
}

/** A taste Qloo understood: an entity (urn:entity:…) or a tag (urn:tag:…) for categories. */
export interface TasteEntity {
  id: string;
  name: string;
  /** Entity type ("tv_show", "movie"…) or "tag" for categories. */
  type: string;
  /** What the person actually typed. */
  input: string;
}

export interface ResolvedTastes {
  found: TasteEntity[];
  missing: string[];
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
}

export type RiskLevel = "low" | "medium" | "high" | "cheating";

export interface ScoreResult {
  /** Cheating risk: average share of each person's liked places the other doesn't like. */
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
  missingA: string[];
  missingB: string[];
  roast: Roast;
  agent: "llm" | "fallback";
  toolCalls: string[];
  /** Roast candidates with judge totals (-1 = dropped as nonsense/unsafe). */
  judged?: { roast: string; total: number; dropped: boolean }[];
  pronounA?: Pronoun;
  pronounB?: Pronoun;
  /** How many "popular for anyone" places were left out of the comparison. */
  popularRemoved?: number;
  timings: Record<string, number>;
}
