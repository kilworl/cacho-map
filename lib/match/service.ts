import type { CityContext, Lang, MatchResult } from "../types";
import { compareTastes, placesNear, resolveTastes } from "../qloo/api";
import { assignZones } from "../geo/zones";
import { score } from "../scoring/score";
import { generateRoast } from "../agent/roast";
import { fallbackRoast } from "../agent/fallback";

const AGENT_TIMEOUT_MS = 14_000;

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
  const [ra, rb] = await Promise.all([resolveTastes(a.tastes), resolveTastes(b.tastes)]);
  timings.search = Date.now() - t0;
  const missing = [...ra.missing, ...rb.missing];
  if (!ra.found.length || !rb.found.length) throw new NoTastesError(missing);

  const ia = ra.found.map((e) => e.id);
  const ib = rb.found.map((e) => e.id);
  const t1 = Date.now();
  const [tags, pa, pb] = await Promise.all([compareTastes(ia, ib), placesNear(ia, city), placesNear(ib, city)]);
  timings.insights = Date.now() - t1;

  const s = score(tags, assignZones(pa, city, lang), assignZones(pb, city, lang));
  const t2 = Date.now();
  let roast;
  let toolCalls: string[] = [];
  let agent: MatchResult["agent"] = "llm";
  const input = { a: a.nick, b: b.nick, tastesA: ra.found.map((e) => e.name), tastesB: rb.found.map((e) => e.name), score: s, lang, city: city.name };
  try {
    // One quick retry for transient gateway errors; hard cap so the user never waits on a stuck model.
    try {
      ({ roast, toolCalls } = await generateRoast({ ...input, signal: AbortSignal.timeout(AGENT_TIMEOUT_MS) }));
    } catch (e) {
      if (Date.now() - t2 > AGENT_TIMEOUT_MS / 2) throw e;
      console.warn("agent retry:", (e as Error).message);
      ({ roast, toolCalls } = await generateRoast({ ...input, signal: AbortSignal.timeout(AGENT_TIMEOUT_MS) }));
    }
  } catch (e) {
    console.error("agent failed, using fallback:", (e as Error).message);
    roast = fallbackRoast(a.nick, b.nick, s, lang);
    agent = "fallback";
  }
  timings.agent = Date.now() - t2;
  timings.total = Date.now() - t0;
  return { a: a.nick, b: b.nick, lang, city, tastesA: ra.found, tastesB: rb.found, missing, ...s, roast, agent, toolCalls, timings };
}
