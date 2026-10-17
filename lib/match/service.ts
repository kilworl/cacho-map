import type { CityContext, Lang, MatchResult } from "../types";
import { compareTastes, placesNear, probeLists, resolveTastes, toSignals } from "../qloo/api";
import { normalizeTastes } from "../tastes/normalize";
import { assignZones } from "../geo/zones";
import { score, TOP_PLACES } from "../scoring/score";
import { favoritePlaces, type InputKind } from "../scoring/blend";
import type { Pronoun, TasteEntity } from "../types";

/** Max inputs per person that get their own Qloo place call. */
const MAX_PLACE_INPUTS = 6;
const inputKind = (e: TasteEntity): InputKind =>
  e.type !== "tag" ? "title" : e.id.startsWith("urn:tag:cuisine") ? "cuisine" : "category";
import { generateRoast } from "../agent/roast";
import { fallbackRoast } from "../agent/fallback";
import { describe } from "../agent/enrich";

const AGENT_TIMEOUT_MS = 30_000;

export interface MatchInput {
  a: { nick: string; tastes: string[]; pronoun?: Pronoun };
  b: { nick: string; tastes: string[]; pronoun?: Pronoun };
  city: CityContext;
  lang: Lang;
}

export class NoTastesError extends Error {
  constructor(public missing: string[]) {
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
  // One LLM call normalizes both people's tastes (Spanish titles -> English, categories -> tags).
  const ta = a.tastes.slice(0, 8);
  const tb = b.tastes.slice(0, 8);
  const normalized = await normalizeTastes([...ta, ...tb]);
  timings.normalize = Date.now() - t0;
  const [ra, rb] = await Promise.all([resolveTastes(normalized.slice(0, ta.length)), resolveTastes(normalized.slice(ta.length))]);
  timings.search = Date.now() - t0 - timings.normalize;
  if (!ra.found.length || !rb.found.length) throw new NoTastesError([...ra.missing, ...rb.missing]);

  const ia = toSignals(ra.found);
  const ib = toSignals(rb.found);
  const t1 = Date.now();
  // One Qloo place list per input, blended with capped weights per input (see lib/scoring/blend),
  // so a single cuisine or category can't take over a person's favorites.
  const perInput = (found: typeof ra.found) =>
    Promise.all(found.slice(0, MAX_PLACE_INPUTS).map(async (e) => ({
      kind: inputKind(e),
      places: await placesNear(e.type === "tag" ? { entities: [], tags: [e.id] } : { entities: [e.id], tags: [] }, city).catch(() => []),
    })));
  const [tags, la, lb, probes] = await Promise.all([compareTastes(ia, ib), perInput(ra.found), perInput(rb.found), probeLists(city).catch(() => [])]);
  const fav = favoritePlaces(la, lb, TOP_PLACES, probes);
  const pa = fav.a;
  const pb = fav.b;
  timings.insights = Date.now() - t1;

  const scored = score(tags, assignZones(pa, city, lang), assignZones(pb, city, lang));
  const t2 = Date.now();
  const s = scored;
  let roast;
  let toolCalls: string[] = [];
  let judged: { roast: string; total: number; dropped: boolean }[] = [];
  let agent: MatchResult["agent"] = "llm";
  const people = { a: { nick: a.nick, pronoun: a.pronoun ?? "n" }, b: { nick: b.nick, pronoun: b.pronoun ?? "n" } } as const;
  const input = { a: people.a, b: people.b, tastesA: ra.found.map((e) => e.name), tastesB: rb.found.map((e) => e.name), score: s, lang, city: city.name };
  const ctx = { a: a.nick, b: b.nick, pa: people.a, pb: people.b, tastesA: input.tastesA, tastesB: input.tastesB, lang };
  // Zone/place descriptions (cheap model) run in parallel with the roast agent.
  const described = describe(s, ctx).then((r) => ((timings.describe = Date.now() - t2), r));
  try {
    // One quick retry for transient gateway errors; hard cap so the user never waits on a stuck model.
    try {
      ({ roast, toolCalls, judged } = await generateRoast({ ...input, signal: AbortSignal.timeout(AGENT_TIMEOUT_MS) }));
    } catch (e) {
      if (Date.now() - t2 > AGENT_TIMEOUT_MS / 3 || (e as Error).message === "no acceptable roast") throw e;
      console.warn("agent retry:", (e as Error).message);
      ({ roast, toolCalls, judged } = await generateRoast({ ...input, signal: AbortSignal.timeout(AGENT_TIMEOUT_MS) }));
    }
  } catch (e) {
    console.error("agent failed, using fallback:", (e as Error).message);
    roast = fallbackRoast(people.a, people.b, s, lang);
    agent = "fallback";
  }
  timings.agent = Date.now() - t2;
  const full = await described;
  timings.total = Date.now() - t0;
  return { a: a.nick, b: b.nick, lang, city, tastesA: ra.found, tastesB: rb.found, missingA: ra.missing, missingB: rb.missing, ...full, popularRemoved: fav.generic.length, roast, agent, toolCalls, judged, pronounA: people.a.pronoun, pronounB: people.b.pronoun, timings };
}
