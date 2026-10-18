import type { MatchRequest } from "./schema";
import { FollowUpNeeded, NoTastesError, runMatch, type MatchOptions } from "./service";
import type { AgentStep, FollowUp, MatchResult, MissingTaste } from "../types";

/** Everything POST /api/match can answer, as one tagged union (also the NDJSON stream events). */
export type MatchEvent =
  | { type: "step"; step: AgentStep }
  | { type: "question"; followUp: FollowUp; trace?: AgentStep[] }
  | { type: "result"; result: MatchResult }
  | { type: "error"; error: "no_tastes" | "busy"; missing?: MissingTaste[] };

/** Runs a validated request and maps the outcome to a final event (never throws). */
export async function matchOutcome(req: MatchRequest, opt: MatchOptions = {}): Promise<Exclude<MatchEvent, { type: "step" }>> {
  const { a, b, city, lang, ask, asked } = req;
  try {
    const result = await runMatch(
      { a: { nick: a.nick || "A", tastes: a.tastes, pronoun: a.pronoun }, b: { nick: b.nick || "B", tastes: b.tastes, pronoun: b.pronoun }, city, lang },
      { ask, asked, ...opt },
    );
    return { type: "result", result };
  } catch (e) {
    if (e instanceof FollowUpNeeded) return { type: "question", followUp: e.followUp, trace: e.trace };
    if (e instanceof NoTastesError) return { type: "error", error: "no_tastes", missing: e.missing };
    console.error("match failed:", (e as Error).message);
    return { type: "error", error: "busy" };
  }
}
