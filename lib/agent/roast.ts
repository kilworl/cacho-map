import { generateText, isStepCount, Output } from "ai";
import { z } from "zod";
import type { Lang, Roast, ScoreResult } from "../types";
import { buildTools } from "./tools";
import { judgePrompt, systemPrompt, userPrompt } from "./prompt";
import { cleanLine, inLang, sanitizeRoast } from "./sanitize";
import { modelId, normalizeModelId } from "./model";
import { fallbackRoast } from "./fallback";

const Candidate = z.object({
  title: z.string().describe("Starts with the risk label, then ' · ' and a punchline of max 6 words"),
  roast: z.string().describe("Setup → punchline, 1-2 sentences, max 30 words"),
});
const RoastSchema = z.object({
  candidates: z.array(Candidate).min(1).max(3).describe("3 different joke candidates"),
  plan: z.string().describe("One-sentence plan at a place both like, so they go out together"),
});
const JudgeSchema = z.object({
  scores: z.array(z.object({
    index: z.number().int(),
    coherence: z.number().int().min(1).max(5),
    wordplay: z.number().int().min(1).max(5),
    funny: z.number().int().min(1).max(5),
    safe: z.number().int().min(1).max(5),
  })),
});
type Scores = z.infer<typeof JudgeSchema>["scores"][number];

interface RoastInput {
  a: string;
  b: string;
  tastesA: string[];
  tastesB: string[];
  score: ScoreResult;
  lang: Lang;
  city: string;
  signal?: AbortSignal;
}

export interface RoastOutput {
  roast: Roast;
  toolCalls: string[];
  /** Candidates with judge scores, for debugging/reporting. */
  judged: { roast: string; total: number; dropped: boolean }[];
}

/** Total judge score; nonsense or unsafe candidates are dropped (-1). */
export function judgeTotal(s?: Scores): number {
  if (!s) return 0;
  if (s.coherence < 3 || s.safe < 4) return -1;
  return s.coherence * 2 + s.wordplay * 2 + s.funny * 2 + s.safe;
}

async function judge(lang: Lang, cands: string[], context: string, signal?: AbortSignal): Promise<Scores[] | null> {
  try {
    const res = await generateText({
      model: normalizeModelId(),
      output: Output.object({ schema: JudgeSchema }),
      prompt: judgePrompt(lang, cands, context),
      temperature: 0,
      abortSignal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000),
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    } as Parameters<typeof generateText>[0]);
    return (res as unknown as { output?: { scores: Scores[] } }).output?.scores ?? null;
  } catch (e) {
    console.warn("judge failed:", (e as Error).message);
    return null;
  }
}

/**
 * Runs the tool-calling agent (Vercel AI Gateway), which writes 3 candidates;
 * a cheap judge model scores them, nonsense is dropped and the best one wins.
 */
export async function generateRoast({ a, b, tastesA, tastesB, score, lang, city, signal }: RoastInput): Promise<RoastOutput> {
  const toolCalls: string[] = [];
  const res = await generateText({
    model: modelId(),
    tools: buildTools(score, a, b),
    stopWhen: isStepCount(4),
    output: Output.object({ schema: RoastSchema }),
    system: systemPrompt(score.risk, lang, city),
    prompt: userPrompt(a, b, tastesA, tastesB, lang),
    temperature: 1,
    abortSignal: signal,
    providerOptions: { google: { thinkingConfig: { thinkingBudget: 512 } } },
    onStepEnd: (step: { toolCalls?: { toolName: string }[] }) => {
      for (const c of step.toolCalls ?? []) toolCalls.push(c.toolName);
    },
  } as Parameters<typeof generateText>[0]);
  const out = (res as unknown as { output?: z.infer<typeof RoastSchema> }).output;
  const cands = (out?.candidates ?? [])
    .map((c) => sanitizeRoast({ ...c, plan: "" }, score.risk, lang, score.zones[0]?.zone))
    .filter((c) => c.roast.split(/\s+/).length >= 6 && inLang(c.roast, lang));
  if (!cands.length || !out) throw new Error("empty roast");

  const context = `${a} likes ${tastesA.join(", ")}; ${b} likes ${tastesB.join(", ")}; places: ${score.pins.slice(0, 12).map((p) => p.name).join(", ")}`;
  const scores = cands.length > 1 ? await judge(lang, cands.map((c) => c.roast), context, signal) : null;
  const judged = cands.map((c, i) => ({ c, total: judgeTotal(scores?.find((s) => s.index === i)) }));
  const ranked = [...judged].sort((x, y) => y.total - x.total);
  const best = ranked[0].total >= 0 ? ranked[0].c : cands[0];
  return {
    roast: { ...best, plan: inLang(out.plan, lang) ? cleanLine(out.plan, score.risk) : fallbackRoast(a, b, score, lang).plan },
    toolCalls,
    judged: judged.map((j) => ({ roast: j.c.roast, total: j.total, dropped: j.total < 0 })),
  };
}
