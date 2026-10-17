/** Shared domain types. Kept framework-free so they can be used by server, client and tests. */
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

export interface TasteEntity {
  id: string;
  name: string;
  type: string;
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
}

export interface ZoneStat extends GeoPoint {
  zone: string;
  /** % of places in this zone that only one of them would pick. */
  clashPct: number;
  n: number;
  both: number;
}

export interface ScoreResult {
  compat: number;
  cachos: number;
  tagScore: number;
  placeScore: number;
  shared: number;
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
  missing: string[];
  roast: Roast;
  agent: "llm" | "fallback";
  toolCalls: string[];
  timings: Record<string, number>;
}
