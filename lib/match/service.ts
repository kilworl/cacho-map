import type { CityContext, Lang, MatchResult } from "../types";
import { compareTastes, placesNear, resolveTastes, toSignals } from "../qloo/api";
import { normalizeTastes } from "../tastes/normalize";
import { assignZones } from "../geo/zones";
import { score } from "../scoring/score";
import { generateRoast } from "../agent/roast";
import { fallbackRoast } from "../agent/fallback";
import { describe } from "../agent/enrich";

const AGENT_TIMEOUT_MS = 20_000;

export interface MatchInput {
  a: { nick: string; tastes: string[] };
  b: { nick: string; tastes: string[] };
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
  // Places come from specific titles when a person gave any. Broad media categories
  // ("video games", "superheroes") are dropped there so they don't inflate shared places;
  // place-relevant categories (cuisines) are kept. Category-only people use all their tags.
  const placeSignals = (s: typeof ia) =>
    s.entities.length ? { entities: s.entities, tags: s.tags.filter((t) => t.startsWith("urn:tag:cuisine")) } : s;
  const [tags, pa, pb] = await Promise.all([compareTastes(ia, ib), placesNear(placeSignals(ia), city), placesNear(placeSignals(ib), city)]);
  timings.insights = Date.now() - t1;

  const scored = score(tags, assignZones(pa, city, lang), assignZones(pb, city, lang));
  const t2 = Date.now();
  const s = scored;
  let roast;
  let toolCalls: string[] = [];
  let judged: { roast: string; total: number; dropped: boolean }[] = [];
  let agent: MatchResult["agent"] = "llm";
  const input = { a: a.nick, b: b.nick, tastesA: ra.found.map((e) => e.name), tastesB: rb.found.map((e) => e.name), score: s, lang, city: city.name };
  const ctx = { a: a.nick, b: b.nick, tastesA: input.tastesA, tastesB: input.tastesB, lang };
  // Zone/place descriptions (cheap model) run in parallel with the roast agent.
  const described = describe(s, ctx).then((r) => ((timings.describe = Date.now() - t2), r));
  try {
    // One quick retry for transient gateway errors; hard cap so the user never waits on a stuck model.
    try {
      ({ roast, toolCalls, judged } = await generateRoast({ ...input, signal: AbortSignal.timeout(AGENT_TIMEOUT_MS) }));
    } catch (e) {
      if (Date.now() - t2 > AGENT_TIMEOUT_MS / 2) throw e;
      console.warn("agent retry:", (e as Error).message);
      ({ roast, toolCalls, judged } = await generateRoast({ ...input, signal: AbortSignal.timeout(AGENT_TIMEOUT_MS) }));
    }
  } catch (e) {
    console.error("agent failed, using fallback:", (e as Error).message);
    roast = fallbackRoast(a.nick, b.nick, s, lang);
    agent = "fallback";
  }
  timings.agent = Date.now() - t2;
  const full = await described;
  timings.total = Date.now() - t0;
  return { a: a.nick, b: b.nick, lang, city, tastesA: ra.found, tastesB: rb.found, missingA: ra.missing, missingB: rb.missing, ...full, roast, agent, toolCalls, judged, timings };
}
