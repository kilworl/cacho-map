import type { GeoPoint, Place, ResolvedTastes, SharedTag, TasteEntity, TasteQuery } from "../types";
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
    short_description?: string;
    description?: string;
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

const ALL_TYPES = ["artist", "movie", "tv_show", "book", "podcast", "videogame"].map((t) => `urn:entity:${t}`).join(",");

/** Qloo signals for one person: specific entities plus general category tags. */
export interface Signals {
  entities: string[];
  tags: string[];
}

export const toSignals = (found: TasteEntity[]): Signals => ({
  entities: found.filter((e) => e.type !== "tag").map((e) => e.id),
  tags: found.filter((e) => e.type === "tag").map((e) => e.id),
});

const signalParams = (s: Signals, prefix = ""): Record<string, string> => ({
  ...(s.entities.length && { [`${prefix}signal.interests.entities`]: s.entities.join(",") }),
  ...(s.tags.length && { [`${prefix}signal.interests.tags`]: s.tags.join(",") }),
});

/** Tag families that make good taste signals, best first (skip e.g. "specialty_dish"). */
const TAG_PREF = ["urn:tag:genre:media", "urn:tag:subgenre:qloo", "urn:tag:genre:music", "urn:tag:cuisine:qloo", "urn:tag:keyword:qloo", "urn:tag:genre:place"];
const tagRank = (type = "", food = false) => {
  if (food && type.startsWith("urn:tag:cuisine")) return -1;
  const i = TAG_PREF.findIndex((p) => type.startsWith(p));
  return i < 0 ? 99 : i;
};

/** "comida mexicana" must resolve to the Mexican cuisine tag, not Mexican music. */
const FOOD = /comida|food|cocina|cuisine|restaurant|plato|dish|sushi|pizza|burger|tacos?|coffee|caf[eé]|beer|cerveza|wine|vino|seafood|mariscos|bbq|ramen|vegan|vegetarian|brunch|dessert|postre/i;

interface RawTagResult {
  id?: string;
  tag_id?: string;
  name: string;
  type?: string;
  types?: string;
}

async function searchEntity(q: TasteQuery): Promise<TasteEntity | null> {
  const run = async (types: string) => entitiesOf(await qlooGet("/search", { query: q.query, types, take: 3 }))[0];
  // Restrict to the type the normalizer detected (Mentalista -> tv_show), then fall back to any type.
  const e = (q.type ? await run(`urn:entity:${q.type}`) : undefined) ?? (await run(ALL_TYPES));
  return e ? { id: e.entity_id, name: e.name, type: (e.types?.[0] ?? e.subtype ?? "").replace("urn:entity:", ""), input: q.input } : null;
}

async function searchTag(q: TasteQuery): Promise<TasteEntity | null> {
  const d = await qlooGet<{ results?: { tags?: RawTagResult[] } }>("/v2/tags", { "filter.query": q.query, take: 8 });
  const tags = (d?.results?.tags ?? []).filter((t) => t.id ?? t.tag_id);
  const food = FOOD.test(`${q.input} ${q.query}`);
  const best = [...tags].sort((x, y) => tagRank(x.type ?? x.types, food) - tagRank(y.type ?? y.types, food))[0];
  return best ? { id: (best.id ?? best.tag_id)!, name: best.name, type: "tag", input: q.input } : null;
}

/** Resolves normalized tastes to Qloo entities (titles) or tags (categories), in parallel. */
export async function resolveTastes(queries: TasteQuery[]): Promise<ResolvedTastes> {
  const results = await Promise.all(
    queries.slice(0, 8).map(async (q) => {
      try {
        const hit = q.kind === "category" ? await searchTag(q) : await searchEntity(q);
        // A "title" that Qloo can't find may still be a category ("superhéroes"), and vice versa.
        return { q, e: hit ?? (q.kind === "category" ? await searchEntity(q) : await searchTag(q)) };
      } catch {
        return { q, e: null };
      }
    }),
  );
  const found: TasteEntity[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const { q, e } of results) {
    if (!e) missing.push(q.input);
    else if (!seen.has(e.id)) { seen.add(e.id); found.push(e); }
  }
  return { found, missing };
}

/** Places nobody goes to on a date: filtered out of recommendations. */
const BORING = /radio|institut|pedagog|urgent|emergenc|medical|doctor|store|shop|supermarket|mall|bank|naval|military|newspaper|publisher|record (label|company)|office|school|academ|universit|church|hospital|clinic|pharmac|gas station|parking|apartment|real estate|tour operator|serviced accommodation|corporate|government|embassy|consulate|airport|bus station|cemetery|dentist|gym|soccer club|stadium|event venue|lawyer|insurance|car |auto |hostel|hotel/i;

/** Generic or non-date entities that leak into place results ("Cartagena de Indias", naval bases, libraries). */
const BORING_NAME = /^(cartagena|bogot[aá]|medell[ií]n|barranquilla|cali|santa marta)( de indias)?$|naval|militar|bibliotec|library|universidad|universitari|instituci[oó]n|instituto|caracol radio|urgencias|casa de nari[ñn]o|suboficiales|centro social|colegio|hospital|cl[ií]nica|notar[ií]a|banco |hotel|hostal|hostel|aeropuerto|airport|school|facultad|academia|escuela|patin[oó]dromo|sociedad portuaria|espectador|edificio|barrio |residential|residencial|conjunto|condominio|colegiatura|unaula|manzana |pablo escobar|^(cl|cra|calle|carrera|av)\.? /i;

const genreOf = (e: RawEntity) =>
  e.tags?.find((t) => /genre:place/.test(t.id ?? t.tag_id ?? "") && t.name && t.name !== "Place")?.name;

const tagsOfType = (e: RawEntity, type: string, n = 3) =>
  [...new Set((e.tags ?? []).filter((t) => t.type === `urn:tag:${type}` && t.name).map((t) => t.name!))].filter((x) => x !== "Place").slice(0, n);

export function toPlace(e: RawEntity): Place | null {
  if (e.location?.lat == null || e.location?.lon == null || e.properties?.is_closed) return null;
  const genre = genreOf(e);
  const genres = (e.tags ?? []).filter((t) => /genre:place/.test(t.id ?? t.tag_id ?? t.type ?? "")).map((t) => t.name ?? "");
  if ((genre && BORING.test(genre)) || genres.some((g) => BORING.test(g)) || BORING_NAME.test(e.name)) return null;
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
    description: (e.properties?.short_description ?? e.properties?.description)?.slice(0, 220),
    tags: {
      genres: tagsOfType(e, "genre:place"),
      cuisines: tagsOfType(e, "cuisine:qloo"),
      ambience: tagsOfType(e, "ambience:qloo"),
      activities: tagsOfType(e, "activity_type:qloo", 2),
    },
  };
}

/**
 * Qloo place recommendations near a point, personalized by taste entities.
 * Widens the radius once if the area is sparse (small towns, rural locations).
 */
export async function placesNear(signals: Signals, at: GeoPoint, radiusM = 9000): Promise<Place[]> {
  const fetchRadius = async (r: number) =>
    entitiesOf(
      await qlooGet("/v2/insights", {
        "filter.type": "urn:entity:place",
        "filter.location": `POINT(${at.lon.toFixed(4)} ${at.lat.toFixed(4)})`,
        "filter.location.radius": r,
        ...signalParams(signals),
        take: 50,
      }),
    ).map(toPlace).filter((p): p is Place => !!p);
  const near = await fetchRadius(radiusM);
  return near.length >= 12 ? near : fetchRadius(radiusM * 4);
}

/** Shared taste tags between two sets of entities (Qloo /v2/insights/compare). */
export async function compareTastes(a: Signals, b: Signals): Promise<SharedTag[]> {
  const d = await qlooGet<{ results?: { tags?: RawTag[] } }>("/v2/insights/compare", { ...signalParams(a, "a."), ...signalParams(b, "b.") });
  const names = (v: unknown) => (Array.isArray(v) ? v.map((x: { name: string }) => x.name) : []);
  return (d?.results?.tags ?? []).map((t) => ({
    name: t.name,
    score: typeof t.query?.score === "number" ? t.query.score : 0,
    a: names(t.query?.["a.signal.interests.entities"]),
    b: names(t.query?.["b.signal.interests.entities"]),
  }));
}
