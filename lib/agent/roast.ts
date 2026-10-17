import { generateText, isStepCount, Output } from "ai";
import { z } from "zod";
import type { Lang, Roast, ScoreResult } from "../types";
import { buildTools } from "./tools";
import { judgePrompt, systemPrompt, userPrompt } from "./prompt";
import { cleanLine, inLang, sanitizeRoast } from "./sanitize";
import { judgeModelId, modelId } from "./model";
import { fallbackRoast } from "./fallback";
import { fixGender, type Person } from "./gender";
import { pickShots } from "./examples";

const Candidate = z.object({
  title: z.string().describe("Starts with the risk label, then ' · ' and a punchline of max 6 words"),
  roast: z.string().describe("Setup → punchline, 1-2 sentences, max 30 words"),
});
const RoastSchema = z.object({
  candidates: z.array(Candidate).min(1).max(3).describe("3 different joke candidates"),
  plan: z.string().describe("One-sentence plan at a place both like, so they go out together"),
});
const Verdict = z.object({
  index: z.number().int(),
  makes_sense: z.boolean(),
  wordplay: z.boolean(),
  punchline_at_end: z.boolean(),
  no_contradiction: z.boolean(),
  safe: z.boolean(),
  funny: z.number().int().min(1).max(5),
});
const JudgeSchema = z.object({ verdicts: z.array(Verdict), ranking: z.array(z.number().int()) });
export type Verdict = z.infer<typeof Verdict>;

interface RoastInput {
  a: Person;
  b: Person;
  tastesA: string[];
  tastesB: string[];
  score: ScoreResult;
  lang: Lang;
  city: string;
  signal?: AbortSignal;
}

export interface Judged {
  roast: string;
  total: number;
  dropped: boolean;
}

export interface RoastOutput {
  roast: Roast;
  toolCalls: string[];
  judged: Judged[];
}

/** Minimum funny score to accept a candidate that passes every criterion. */
export const MIN_FUNNY = 3;
/** Only regenerate if the first round finished within this budget. */
const REGEN_BUDGET_MS = 9_000;

/** A candidate passes only if it meets every criterion and is at least mildly funny. */
export function passes(v?: Verdict): boolean {
  return !!v && v.makes_sense && v.wordplay && v.punchline_at_end && v.no_contradiction && v.safe && v.funny >= MIN_FUNNY;
}

/** Ranking position (lower is better) used to break ties between passing candidates. */
export function pickBest<T>(cands: T[], verdicts: Verdict[] | null, ranking: number[] | null): { best: T | null; totals: number[] } {
  const totals = cands.map((_, i) => {
    const v = verdicts?.find((x) => x.index === i);
    if (!verdicts) return 0;
    if (!passes(v)) return -1;
    const pos = ranking?.indexOf(i) ?? -1;
    return v!.funny * 10 + (pos < 0 ? 0 : cands.length - pos);
  });
  const order = totals.map((t, i) => [t, i] as const).sort((x, y) => y[0] - x[0]);
  if (!verdicts) return { best: cands[0] ?? null, totals };
  return { best: order.length && order[0][0] > 0 ? cands[order[0][1]] : null, totals };
}

async function judge(lang: Lang, cands: string[], context: string, signal?: AbortSignal) {
  try {
    const res = await generateText({
      model: judgeModelId(),
      output: Output.object({ schema: JudgeSchema }),
      prompt: judgePrompt(lang, cands, context),
      temperature: 0,
      maxRetries: 1,
      abortSignal: signal ? AbortSignal.any([signal, AbortSignal.timeout(7000)]) : AbortSignal.timeout(7000),
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 256 } } },
    } as Parameters<typeof generateText>[0]);
    return (res as unknown as { output?: z.infer<typeof JudgeSchema> }).output ?? null;
  } catch (e) {
    console.warn("judge failed:", (e as Error).message);
    return null;
  }
}

async function candidates(input: RoastInput, toolCalls: string[]) {
  const { a, b, tastesA, tastesB, score, lang, city, signal } = input;
  const res = await generateText({
    model: modelId(),
    tools: buildTools(score, a.nick, b.nick),
    stopWhen: isStepCount(4),
    output: Output.object({ schema: RoastSchema }),
    system: systemPrompt(score.risk, lang, city, pickShots([...tastesA, ...tastesB], lang)),
    prompt: userPrompt(a, b, tastesA, tastesB, lang),
    temperature: 1,
    abortSignal: signal,
    providerOptions: { google: { thinkingConfig: { thinkingBudget: 512 } } },
    onStepEnd: (step: { toolCalls?: { toolName: string }[] }) => {
      for (const c of step.toolCalls ?? []) toolCalls.push(c.toolName);
    },
  } as Parameters<typeof generateText>[0]);
  const out = (res as unknown as { output?: z.infer<typeof RoastSchema> }).output;
  const people = [a, b];
  const cands = (out?.candidates ?? [])
    .map((c) => sanitizeRoast({ ...c, plan: "" }, score.risk, lang, score.zones[0]?.zone))
    .map((c) => ({ ...c, roast: fixGender(c.roast, people, lang) }))
    .filter((c) => c.roast.split(/\s+/).length >= 6 && inLang(c.roast, lang));
  return { cands, plan: out?.plan ?? "" };
}

/**
 * Tool-calling agent writes 3 candidates; a judge (gemini-2.5-flash) checks explicit
 * criteria and ranks them. If none passes, we regenerate once (time permitting),
 * then fall back to the best-ranked sensible one, or the template.
 */
export async function generateRoast(input: RoastInput): Promise<RoastOutput> {
  const { a, b, tastesA, tastesB, score, lang } = input;
  const t0 = Date.now();
  const toolCalls: string[] = [];
  const pronouns = (p: Person) => `${p.nick} (${p.pronoun === "m" ? "he" : p.pronoun === "f" ? "she" : "they"})`;
  const context = `${pronouns(a)} likes ${tastesA.join(", ")}; ${pronouns(b)} likes ${tastesB.join(", ")}; places: ${score.pins.slice(0, 12).map((p) => p.name).join(", ")}`;

  const judged: Judged[] = [];
  let plan = "";
  let best: { title: string; roast: string } | null = null;
  let anySensible: { title: string; roast: string } | null = null;
  for (let round = 0; round < 2 && !best; round++) {
    if (round === 1 && Date.now() - t0 > REGEN_BUDGET_MS) break;
    const r = await candidates(input, toolCalls);
    plan ||= r.plan;
    if (!r.cands.length) continue;
    const j = await judge(lang, r.cands.map((c) => c.roast), context, input.signal);
    const pick = pickBest(r.cands, j?.verdicts ?? null, j?.ranking ?? null);
    r.cands.forEach((c, i) => judged.push({ roast: c.roast, total: pick.totals[i], dropped: pick.totals[i] < 0 }));
    best = pick.best;
    // Best-ranked candidate that at least makes sense and is safe, for when nobody passes.
    const sensible = (j?.ranking ?? []).map((i) => ({ i, v: j?.verdicts.find((v) => v.index === i) })).find(({ v }) => v?.makes_sense && v.safe && v.no_contradiction);
    if (sensible && r.cands[sensible.i]) anySensible = r.cands[sensible.i];
  }
  const chosen = best ?? anySensible;
  if (!chosen) throw new Error("no acceptable roast");
  const cleanPlan = fixGender(cleanLine(plan, score.risk), [a, b], lang);
  return {
    roast: { ...chosen, plan: cleanPlan && inLang(cleanPlan, lang) ? cleanPlan : fallbackRoast(a, b, score, lang).plan },
    toolCalls,
    judged,
  };
}
