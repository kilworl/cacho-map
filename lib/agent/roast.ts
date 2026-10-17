import { generateText, isStepCount, Output } from "ai";
import { z } from "zod";
import type { Lang, Roast, ScoreResult } from "../types";
import { buildTools } from "./tools";
import { systemPrompt, userPrompt } from "./prompt";
import { sanitizeRoast } from "./sanitize";
import { modelId } from "./model";

const RoastSchema = z.object({
  title: z.string().describe("Starts with the overall % label, then ' · ' and a short punchline"),
  roast: z.string().describe("1-2 sentence roast, max 35 words"),
  plan: z.string().describe("One-sentence date plan at a place both agree on"),
});


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

/** Runs the tool-calling agent (Vercel AI Gateway) and enforces the humor contract on its output. */
export async function generateRoast({ a, b, tastesA, tastesB, score, lang, city, signal }: RoastInput): Promise<{ roast: Roast; toolCalls: string[] }> {
  const toolCalls: string[] = [];
  const res = await generateText({
    model: modelId(),
    tools: buildTools(score, a, b),
    stopWhen: isStepCount(4),
    output: Output.object({ schema: RoastSchema }),
    system: systemPrompt(score.cachos, lang, city),
    prompt: userPrompt(a, b, tastesA, tastesB, lang),
    temperature: 0.9,
    abortSignal: signal,
    providerOptions: { google: { thinkingConfig: { thinkingBudget: 512 } } },
    onStepEnd: (step: { toolCalls?: { toolName: string }[] }) => {
      for (const c of step.toolCalls ?? []) toolCalls.push(c.toolName);
    },
  } as Parameters<typeof generateText>[0]);
  const out = (res as unknown as { output?: Roast }).output;
  if (!out?.roast) throw new Error("empty roast");
  return { roast: sanitizeRoast(out, score.cachos, lang, score.zones[0]?.zone), toolCalls };
}
