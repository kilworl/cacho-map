import type { GeoPoint, Place, SharedTag, TasteEntity } from "../types";
import { normalizeName } from "../text/titleCase";
import { qlooGet } from "./client";

/* Raw response shapes (only the fields we use). */
interface RawEntity {
  entity_id: string;
  name: string;
  types?: string[];
  subtype?: string;
  location?: { lat?: number; lon?: number };
  query?: { affinity?: number };
  tags?: { id?: string; tag_id?: string; name?: string; type?: string }[];
  properties?: {
    neighborhood?: string;
    geocode?: { name?: string };
    business_rating?: number;
    price_level?: number;
    images?: { url?: string }[];
    is_closed?: boolean;
  };
}
interface RawTag {
  name: string;
  query?: { score?: number } & Record<string, { name: string }[] | number | undefined>;
}

const entitiesOf = (d: unknown): RawEntity[] => {
  const r = (d as { results?: RawEntity[] | { entities?: RawEntity[] } })?.results;
  return (Array.isArray(r) ? r : r?.entities) ?? [];
};

const SEARCH_TYPES = ["artist", "movie", "tv_show", "book", "place", "podcast", "videogame"].map((t) => `urn:entity:${t}`).join(",");

/** Resolves free-text tastes ("Bad Bunny", "Shrek") to Qloo entities, in parallel. */
export async function resolveTastes(terms: string[]): Promise<{ found: TasteEntity[]; missing: string[] }> {
  const results = await Promise.all(
    terms.slice(0, 6).map(async (q) => {
      try {
        const e = entitiesOf(await qlooGet("/search", { query: q, types: SEARCH_TYPES, take: 3 }))[0];
        return e ? { q, e: { id: e.entity_id, name: e.name, type: (e.types?.[0] ?? e.subtype ?? "").replace("urn:entity:", "") } } : { q };
      } catch {
        return { q };
      }
    }),
  );
  const found: TasteEntity[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (!r.e) missing.push(r.q);
    else if (!seen.has(r.e.id)) { seen.add(r.e.id); found.push(r.e); }
  }
  return { found, missing };
}

/** Places nobody goes to on a date: filtered out of recommendations. */
const BORING = /store|shop|supermarket|mall|bank|naval|military|newspaper|publisher|record (label|company)|office|school|academ|universit|church|hospital|clinic|pharmac|gas station|parking|apartment|real estate|tour operator|serviced accommodation|corporate|government|embassy|consulate|airport|bus station|cemetery|dentist|gym|soccer club|stadium|event venue|lawyer|insurance|car |auto |hostel|hotel/i;

/** Generic or non-date entities that leak into place results ("Cartagena de Indias", naval bases, libraries). */
const BORING_NAME = /^(cartagena|bogot[aá]|medell[ií]n|barranquilla|cali|santa marta)( de indias)?$|naval|militar|bibliotec|library|universidad|colegio|hospital|cl[ií]nica|notar[ií]a|banco |hotel|hostal|hostel|aeropuerto|airport|school|facultad|academia|escuela|patin[oó]dromo|sociedad portuaria|espectador|edificio|^(cl|cra|calle|carrera|av)\.? /i;

const genreOf = (e: RawEntity) =>
  e.tags?.find((t) => /genre:place/.test(t.id ?? t.tag_id ?? "") && t.name && t.name !== "Place")?.name;

export function toPlace(e: RawEntity): Place | null {
  if (e.location?.lat == null || e.location?.lon == null || e.properties?.is_closed) return null;
  const genre = genreOf(e);
  if ((genre && BORING.test(genre)) || BORING_NAME.test(e.name)) return null;
  return {
    id: e.entity_id,
    name: normalizeName(e.name.split(" | ")[0]),
    lat: e.location.lat,
    lon: e.location.lon,
    affinity: e.query?.affinity ?? 0,
    neighborhood: e.properties?.neighborhood ?? e.properties?.geocode?.name,
    genre,
    rating: e.properties?.business_rating,
    priceLevel: e.properties?.price_level,
    image: e.properties?.images?.[0]?.url,
  };
}

/**
 * Qloo place recommendations near a point, personalized by taste entities.
 * Widens the radius once if the area is sparse (small towns, rural locations).
 */
export async function placesNear(ids: string[], at: GeoPoint, radiusM = 9000): Promise<Place[]> {
  const fetchRadius = async (r: number) =>
    entitiesOf(
      await qlooGet("/v2/insights", {
        "filter.type": "urn:entity:place",
        "filter.location": `POINT(${at.lon.toFixed(4)} ${at.lat.toFixed(4)})`,
        "filter.location.radius": r,
        "signal.interests.entities": ids.join(","),
        take: 50,
      }),
    ).map(toPlace).filter((p): p is Place => !!p);
  const near = await fetchRadius(radiusM);
  return near.length >= 12 ? near : fetchRadius(radiusM * 4);
}

/** Shared taste tags between two sets of entities (Qloo /v2/insights/compare). */
export async function compareTastes(a: string[], b: string[]): Promise<SharedTag[]> {
  const d = await qlooGet<{ results?: { tags?: RawTag[] } }>("/v2/insights/compare", {
    "a.signal.interests.entities": a.join(","),
    "b.signal.interests.entities": b.join(","),
  });
  const names = (v: unknown) => (Array.isArray(v) ? v.map((x: { name: string }) => x.name) : []);
  return (d?.results?.tags ?? []).map((t) => ({
    name: t.name,
    score: typeof t.query?.score === "number" ? t.query.score : 0,
    a: names(t.query?.["a.signal.interests.entities"]),
    b: names(t.query?.["b.signal.interests.entities"]),
  }));
}
