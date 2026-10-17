import type { GeoPoint, MissingTaste, ParsedTaste, Place, ResolvedTastes, SharedTag, TasteEntity, TasteQuery } from "../types";
import { matchConfidence } from "../tastes/match";
import { PLACE_KINDS, isPlaceKind, placeKindTags, type PlaceKind } from "../places/catalog";
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
    akas?: { language?: string; value?: string }[];
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

const entityOf = (e: RawEntity, input: string): TasteEntity => {
  // Latin-script alternate titles (e.g. Spanish release names) and Qloo's description: the only
  // facts about this taste a joke may cite (see lib/agent/ownership).
  const akas = [...new Set((e.properties?.akas ?? []).map((a) => a.value ?? "").filter((v) => v && /^[\p{Script=Latin}\d\s&'’:.,!¡?¿-]+$/u.test(v)))].slice(0, 12);
  const facts = [e.properties?.short_description, e.properties?.description].filter(Boolean).join(" ").slice(0, 600);
  return { id: e.entity_id, name: e.name, type: (e.types?.[0] ?? e.subtype ?? "").replace("urn:entity:", ""), input, akas, facts };
};

async function entityCandidates(query: string, type?: string): Promise<RawEntity[]> {
  const run = async (types: string) => entitiesOf(await qlooGet("/search", { query, types, take: 3 }));
  // Restrict to the type the parser detected (Mentalista -> tv_show), then fall back to any type.
  const typed = type ? await run(`urn:entity:${type}`) : [];
  return typed.length ? typed : run(ALL_TYPES);
}

async function searchEntity(q: TasteQuery): Promise<TasteEntity | null> {
  const e = (await entityCandidates(q.query, q.type))[0];
  return e ? entityOf(e, q.input) : null;
}

async function searchTag(q: TasteQuery): Promise<TasteEntity | null> {
  const d = await qlooGet<{ results?: { tags?: RawTagResult[] } }>("/v2/tags", { "filter.query": q.query, take: 8 });
  const tags = (d?.results?.tags ?? []).filter((t) => t.id ?? t.tag_id);
  const food = FOOD.test(`${q.input} ${q.query}`);
  const best = [...tags].sort((x, y) => tagRank(x.type ?? x.types, food) - tagRank(y.type ?? y.types, food))[0];
  return best ? { id: (best.id ?? best.tag_id)!, name: best.name, type: "tag", input: q.input } : null;
}

/** Tag families per domain, best first; place genres are never used as taste signals. */
const DOMAIN_PREF: Record<string, string[]> = {
  media: ["urn:tag:genre:media", "urn:tag:keyword:qloo", "urn:tag:subgenre:qloo"],
  music: ["urn:tag:genre:music", "urn:tag:subgenre:qloo", "urn:tag:keyword:qloo"],
  food: ["urn:tag:cuisine:qloo", "urn:tag:keyword:qloo"],
};

async function tagCandidates(query: string, domain?: string): Promise<RawTagResult[]> {
  const d = await qlooGet<{ results?: { tags?: RawTagResult[] } }>("/v2/tags", { "filter.query": query, take: 12 });
  const pref = DOMAIN_PREF[domain ?? ""] ?? Object.values(DOMAIN_PREF).flat();
  const rank = (t: RawTagResult) => {
    const i = pref.findIndex((p) => (t.type ?? t.types ?? t.id ?? "").startsWith(p) || (t.id ?? t.tag_id ?? "").startsWith(p));
    return i < 0 ? 99 : i;
  };
  return (d?.results?.tags ?? []).filter((t) => (t.id ?? t.tag_id) && rank(t) < 99).sort((x, y) => rank(x) - rank(y));
}

export interface Understood {
  found: TasteEntity[];
  missing: MissingTaste[];
}

/**
 * Resolves one parsed taste and checks the match is really what was meant:
 * titles -> Qloo entity (name/alternate titles must match), genres/foods -> Qloo tag
 * (strict word match), activities -> place kinds only. A rejected best guess is kept
 * as `got` so the UI can say "Qloo only found 40k".
 */
export async function resolveParsed(t: ParsedTaste): Promise<TasteEntity | MissingTaste> {
  const places = t.places.filter(isPlaceKind);
  const base = { input: t.input, kind: t.kind, label: t.label, places };
  const queries = [t.query, ...(t.alt ?? [])];
  let got: string | undefined;
  try {
    if (t.kind === "title") {
      for (const q of queries) {
        const cands = await entityCandidates(q, t.type);
        for (const c of cands) {
          const e = entityOf(c, t.input);
          if (matchConfidence(q, e.name, { akas: e.akas }).ok || matchConfidence(t.input, e.name, { akas: e.akas }).ok) return { ...e, ...base, signal: true };
          got ??= e.name;
        }
      }
    } else if (t.kind !== "activity") {
      for (const q of queries) {
        for (const c of await tagCandidates(q, t.domain)) {
          if (matchConfidence(q, c.name, { strict: true }).ok) return { id: (c.id ?? c.tag_id)!, name: c.name, type: "tag", ...base, signal: true };
          got ??= c.name;
        }
      }
    }
  } catch {
    /* Qloo hiccup: fall through to place kinds */
  }
  // Lifestyle tastes (gym, beach) and genres/foods without a trustworthy Qloo tag still work via place kinds.
  if (places.length) return { id: `place:${places.join("+")}`, name: t.label.en, type: "place_kind", ...base, signal: false };
  return { input: t.input, label: t.label, reason: got ? "low_confidence" : "no_match", ...(got && { got }) };
}

export async function understand(items: ParsedTaste[]): Promise<Understood> {
  const res = await Promise.all(items.map(resolveParsed));
  const found: TasteEntity[] = [];
  const missing: MissingTaste[] = [];
  const seen = new Set<string>();
  for (const r of res) {
    if ("reason" in r) missing.push(r);
    else if (!seen.has(r.id)) { seen.add(r.id); found.push(r); }
  }
  return { found, missing };
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
  const missing: MissingTaste[] = [];
  const seen = new Set<string>();
  for (const { q, e } of results) {
    if (!e) missing.push({ input: q.input, reason: "no_match" });
    else if (!seen.has(e.id)) { seen.add(e.id); found.push(e); }
  }
  return { found, missing };
}

/** Places nobody goes to on a date: filtered out of recommendations. */
const BORING = /radio|airline|salon|barber|beauty|nail|institut|pedagog|urgent|emergenc|medical|doctor|store|shop|supermarket|mall|bank|naval|military|newspaper|publisher|record (label|company)|office|school|academ|universit|church|hospital|clinic|pharmac|gas station|parking|apartment|real estate|tour operator|serviced accommodation|corporate|government|embassy|consulate|airport|bus station|cemetery|dentist|gym|soccer club|stadium|event venue|lawyer|insurance|car |auto |hostel|hotel/i;

/** Generic or non-date entities that leak into place results ("Cartagena de Indias", naval bases, libraries). */
const BORING_NAME = /^(cartagena|bogot[aá]|medell[ií]n|barranquilla|cali|santa marta)( de indias)?$|naval|militar|bibliotec|library|universidad|universitari|instituci[oó]n|instituto|caracol radio|urgencias|avianca|peluquer|barber[ií]a|casa de nari[ñn]o|suboficiales|centro social|colegio|hospital|cl[ií]nica|notar[ií]a|banco |hotel|hostal|hostel|aeropuerto|airport|school|facultad|academia|escuela|patin[oó]dromo|sociedad portuaria|espectador|edificio|barrio |residential|residencial|conjunto|condominio|colegiatura|unaula|manzana |pablo escobar|^(cl|cra|calle|carrera|av)\.? /i;

const genreOf = (e: RawEntity) =>
  e.tags?.find((t) => /genre:place/.test(t.id ?? t.tag_id ?? "") && t.name && t.name !== "Place")?.name;

const tagsOfType = (e: RawEntity, type: string, n = 3) =>
  [...new Set((e.tags ?? []).filter((t) => t.type === `urn:tag:${type}` && t.name).map((t) => t.name!))].filter((x) => x !== "Place").slice(0, n);

/** `wanted`: place-genre tag ids the person asked for (e.g. gyms), which then aren't filtered out as boring. */
export function toPlace(e: RawEntity, wanted?: Set<string>): Place | null {
  if (e.location?.lat == null || e.location?.lon == null || e.properties?.is_closed) return null;
  const placeTags = (e.tags ?? []).filter((t) => /genre:place/.test(t.id ?? t.tag_id ?? t.type ?? ""));
  const asked = wanted && placeTags.some((t) => wanted.has(t.id ?? t.tag_id ?? ""));
  // A requested kind leads ("Gym" instead of "Place"), so popups and zone copy show why it's there.
  const lead = asked ? placeTags.find((t) => wanted!.has(t.id ?? t.tag_id ?? ""))?.name : undefined;
  const genre = lead ?? genreOf(e);
  const genres = placeTags.map((t) => t.name ?? "");
  if (!asked && ((genre && BORING.test(genre)) || genres.some((g) => BORING.test(g)))) return null;
  if (BORING_NAME.test(e.name)) return null;
  if (wanted && !asked) return null;
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
      genres: lead ? [lead, ...tagsOfType(e, "genre:place").filter((g) => g !== lead)].slice(0, 3) : tagsOfType(e, "genre:place"),
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
    ).map((x) => toPlace(x)).filter((p): p is Place => !!p);
  const near = await fetchRadius(radiusM);
  return near.length >= 12 ? near : fetchRadius(radiusM * 4);
}

/**
 * One taste's Qloo places near the couple. With place kinds (anime -> cinemas,
 * video game stores) Qloo returns places of those kinds ranked for the taste
 * signal; that's what makes "you'd go here because of X" explainable. Tastes with
 * no place kinds (or none nearby) fall back to Qloo's general places for its fans;
 * lifestyle tastes with no such places nearby get none (shown as "no places").
 */
export async function placesForTaste(e: TasteEntity, at: GeoPoint): Promise<{ places: Place[]; mode?: "typed" | "general" }> {
  const kinds = (e.places ?? []).filter(isPlaceKind) as PlaceKind[];
  const signals: Signals = !e.signal ? { entities: [], tags: [] } : e.type === "tag" ? { entities: [], tags: [e.id] } : { entities: [e.id], tags: [] };
  if (kinds.length) {
    const tags = placeKindTags(kinds);
    const wanted = new Set(tags);
    const fetchR = async (r: number) =>
      entitiesOf(await qlooGet("/v2/insights", {
        "filter.type": "urn:entity:place",
        "filter.location": `POINT(${at.lon.toFixed(4)} ${at.lat.toFixed(4)})`,
        "filter.location.radius": r,
        "filter.tags": tags.join(","),
        ...signalParams(signals),
        take: 30,
      })).map((x) => toPlace(x, wanted)).filter((p): p is Place => !!p);
    let typed = await fetchR(12_000);
    if (typed.length < 4) typed = await fetchR(40_000);
    if (typed.length) return { places: typed, mode: "typed" };
  }
  if (!e.signal) return { places: [] };
  return { places: await placesNear(signals, at), mode: "general" };
}

export { PLACE_KINDS };

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

/** Unrelated tastes used to learn which places Qloo recommends to almost anyone in a city. */
const PROBES: TasteQuery[] = [
  { input: "The Lion King", kind: "title", query: "The Lion King", type: "movie" },
  { input: "Ludwig van Beethoven", kind: "title", query: "Ludwig van Beethoven", type: "artist" },
  { input: "MasterChef", kind: "title", query: "MasterChef", type: "tv_show" },
  { input: "The Great Gatsby", kind: "title", query: "The Great Gatsby", type: "book" },
];

/** Place lists for the probe tastes near a point (cached like every Qloo call). */
export async function probeLists(at: GeoPoint): Promise<Place[][]> {
  const { found } = await resolveTastes(PROBES);
  return Promise.all(found.map((e) => placesNear({ entities: [e.id], tags: [] }, at).catch(() => [])));
}
