import type { CityContext, Lang, MatchResult } from "../types";
import { compareTastes, placesForTaste, probeLists, toSignals, understand } from "../qloo/api";
import { parseTastes } from "../tastes/parse";
import { assignZones } from "../geo/zones";
import { DEEP_PLACES, score, TOP_PLACES } from "../scoring/score";
import { mergeDuplicates, pairTastes } from "../tastes/dedupe";
import { favoritePlaces, type InputKind } from "../scoring/blend";
import type { MissingTaste, Place, Pronoun, TasteEntity } from "../types";

/** Max inputs per person that get their own Qloo place call. */
const MAX_PLACE_INPUTS = 7;
const inputKind = (e: TasteEntity, mode?: "typed" | "general"): InputKind =>
  mode === "typed" ? "typed" : e.type !== "tag" ? "title" : e.id.startsWith("urn:tag:cuisine") ? "cuisine" : "category";
import { generateRoast, type Judged } from "../agent/roast";
import { fallbackRoast } from "../agent/fallback";
import { describe } from "../agent/enrich";

const AGENT_TIMEOUT_MS = 35_000;

export interface MatchInput {
  /** Free text per person ("me gusta el gym y ver anime"); split into atomic tastes by an LLM. */
  a: { nick: string; tastes: string; pronoun?: Pronoun };
  b: { nick: string; tastes: string; pronoun?: Pronoun };
  city: CityContext;
  lang: Lang;
}

export class NoTastesError extends Error {
  constructor(public missing: MissingTaste[]) {
    super("no tastes resolved");
  }
}

/**
 * The whole pipeline: Qloo entity search -> Qloo compare + place insights near the
 * user (in parallel) -> zones -> pure scoring -> tool-calling roast agent.
 */
export async function runMatch({ a, b, city, lang }: MatchInput): Promise<MatchResult> {
  const t0 = Date.now();
  const timings: Record<string, number> = {};
  // One LLM call splits each person's free text into atomic tastes with English Qloo queries and place kinds.
  // The "popular for anyone" probe lists don't depend on the couple: start them right away.
  const probesP = probeLists(city).catch(() => []);
  const parsed = await parseTastes(a.tastes, b.tastes);
  timings.parse = Date.now() - t0;
  const [ua, ub] = await Promise.all([understand(parsed.a, city), understand(parsed.b, city)]);
  timings.search = Date.now() - t0 - timings.parse;
  if (!ua.found.length || !ub.found.length) throw new NoTastesError([...ua.missing, ...ub.missing]);
  // Fold each person's near-duplicates ("ceviche" + "mariscos"), then link same-kind tastes across
  // the couple ("salsa" <-> "bailar salsa" get the same Qloo signal and place kinds).
  const paired = pairTastes(mergeDuplicates(ua.found), mergeDuplicates(ub.found));
  ua.found = paired.a;
  ub.found = paired.b;

  const t1 = Date.now();
  // One Qloo place list per taste (places of the kinds it leads to, ranked for it), blended with capped weights.
  const lists = (u: typeof ua) =>
    Promise.all(u.found.slice(0, MAX_PLACE_INPUTS).map(async (e) => {
      const r = await placesForTaste(e, city).catch(() => ({ places: [] as Place[], mode: undefined }));
      return { e, ...r };
    }));
  const [la, lb, probes] = await Promise.all([lists(ua), lists(ub), probesP]);
  // Lifestyle tastes with no such places nearby are dropped honestly ("no gyms near you"); the rest keep their signal.
  const keep = (u: typeof ua, l: typeof la) => {
    const noPlaces = l.filter((x) => !x.places.length && !x.e.signal);
    const kept = u.found.filter((e) => !noPlaces.some((x) => x.e === e));
    const found = kept.map((e) => {
      const x = l.find((y) => y.e === e);
      return x ? { ...e, placeMode: x.mode, placeCount: x.places.length } : e;
    });
    const missing = [...u.missing, ...noPlaces.map((x): MissingTaste => ({ input: x.e.input, label: x.e.label, reason: "no_places" }))];
    // Per-taste lists, indexed like `found`, for the blend (attribution maps list index -> taste index).
    const withPlaces = l.filter((x) => x.places.length).map((x) => ({ idx: kept.indexOf(x.e), kind: inputKind(x.e, x.mode), places: x.places }));
    return { found, missing, withPlaces, kept };
  };
  const ka = keep(ua, la);
  const kb = keep(ub, lb);
  // Dropped tastes shift indexes: re-point each `pair` to the partner's kept list.
  const repair = (k: typeof ka, other: typeof ka, otherAll: TasteEntity[]) => {
    k.found = k.found.map((e) => {
      const j = e.pair == null ? -1 : other.kept.indexOf(otherAll[e.pair]);
      const rest = { ...e };
      delete rest.pair;
      return j < 0 ? rest : { ...rest, pair: j };
    });
  };
  repair(ka, kb, ub.found);
  repair(kb, ka, ua.found);
  if (!ka.withPlaces.length || !kb.withPlaces.length) throw new NoTastesError([...ka.missing, ...kb.missing]);
  const ia = toSignals(ka.found.filter((e) => e.signal));
  const ib = toSignals(kb.found.filter((e) => e.signal));
  const hasSignal = (x: typeof ia) => x.entities.length + x.tags.length > 0;
  const tags = hasSignal(ia) && hasSignal(ib) ? await compareTastes(ia, ib).catch(() => []) : [];
  const fav = favoritePlaces(ka.withPlaces, kb.withPlaces, TOP_PLACES, probes, DEEP_PLACES);
  const remap = (ps: typeof fav.a, w: typeof ka.withPlaces) => ps.map((p) => ({ ...p, from: p.from.map((i) => w[i].idx) }));
  const pa = remap(fav.a, ka.withPlaces);
  const pb = remap(fav.b, kb.withPlaces);
  const ra = { found: ka.found, missing: ka.missing };
  const rb = { found: kb.found, missing: kb.missing };
  timings.insights = Date.now() - t1;

  const scored = score(tags, assignZones(pa.slice(0, TOP_PLACES), city, lang), assignZones(pb.slice(0, TOP_PLACES), city, lang), {
    deepA: pa, deepB: pb, tastesA: ka.found, tastesB: kb.found,
  });
  const t2 = Date.now();
  const s = scored;
  let roast;
  let toolCalls: string[] = [];
  let judged: Judged[] = [];
  let usedTemplate = false;
  let agent: MatchResult["agent"] = "llm";
  // Jokes use the taste's label in the chosen language ("películas de acción" / "action movies").
  const jokeName = (e: TasteEntity) => e.label?.[lang] ?? (lang === "es" ? e.input : e.name.replace(/\s*\(.*\)$/, "").replace(/:.*$/, ""));
  const people = { a: { nick: a.nick, pronoun: a.pronoun ?? "n" }, b: { nick: b.nick, pronoun: b.pronoun ?? "n" } } as const;
  const input = { a: people.a, b: people.b, tastesA: ra.found.map(jokeName), tastesB: rb.found.map(jokeName), entitiesA: ra.found, entitiesB: rb.found, score: s, lang, city: city.name };
  const ctx = { a: a.nick, b: b.nick, pa: people.a, pb: people.b, tastesA: input.tastesA, tastesB: input.tastesB, lang };
  // Zone/place descriptions (cheap model) run in parallel with the roast agent.
  const described = describe(s, ctx).then((r) => ((timings.describe = Date.now() - t2), r));
  try {
    // One quick retry for transient gateway errors; hard cap so the user never waits on a stuck model.
    try {
      ({ roast, toolCalls, judged, usedTemplate } = await generateRoast({ ...input, signal: AbortSignal.timeout(AGENT_TIMEOUT_MS) }));
    } catch (e) {
      if (Date.now() - t2 > AGENT_TIMEOUT_MS / 3 || (e as Error).message === "no acceptable roast") throw e;
      console.warn("agent retry:", (e as Error).message);
      ({ roast, toolCalls, judged, usedTemplate } = await generateRoast({ ...input, signal: AbortSignal.timeout(AGENT_TIMEOUT_MS) }));
    }
  } catch (e) {
    console.error("agent failed, using fallback:", (e as Error).message);
    roast = fallbackRoast(people.a, people.b, s, lang, input.tastesA, input.tastesB);
    agent = "fallback";
  }
  if (usedTemplate) agent = "fallback";
  timings.agent = Date.now() - t2;
  const full = await described;
  timings.total = Date.now() - t0;
  return { a: a.nick, b: b.nick, lang, city, tastesA: ra.found, tastesB: rb.found, missingA: ra.missing, missingB: rb.missing, ...full, popularRemoved: fav.generic.length, roast, agent, toolCalls, judged, parsedBy: parsed.llm ? "llm" : "heuristic", pronounA: people.a.pronoun, pronounB: people.b.pronoun, timings };
}
