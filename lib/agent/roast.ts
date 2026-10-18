import { generateText, isStepCount, Output } from "ai";
import { z } from "zod";
import type { Lang, Roast, ScoreResult } from "../types";
import { buildTools, toolSnapshot } from "./tools";
import { checkJoke, checkReferences, fold, type OwnershipCtx } from "./ownership";
import type { TasteEntity } from "../types";
import { judgePrompt, systemPrompt, userPrompt } from "./prompt";
import { cleanLine, inLang, sanitizeRoast, tameAdjectives } from "./sanitize";
import { judgeModelId, modelId } from "./model";
import { fallbackRoast, sharedPairs } from "./fallback";
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
  facts_cited: z
    .array(z.object({ fact: z.string(), attributed_to: z.string(), true_owner: z.string(), correct: z.boolean() }))
    .describe("Every taste, work, song, place or trait the title+joke cites, who the joke credits it to, who really has it"),
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
  /** Resolved Qloo entities per person, for the ownership check. */
  entitiesA: TasteEntity[];
  entitiesB: TasteEntity[];
  score: ScoreResult;
  lang: Lang;
  city: string;
  signal?: AbortSignal;
}

export interface Judged {
  title?: string;
  roast: string;
  total: number;
  dropped: boolean;
  /** Why it was rejected (deterministic check or judge). */
  reason?: string;
}

export interface RoastOutput {
  roast: Roast;
  toolCalls: string[];
  judged: Judged[];
  /** True when every candidate failed and the safe template was used. */
  usedTemplate: boolean;
}

/** Minimum funny score to accept a candidate that passes every criterion. */
export const MIN_FUNNY = 3;
/** Only regenerate if the first round finished within this budget. */
const REGEN_BUDGET_MS = 14_000;

/** A candidate passes only if it meets every criterion and is at least mildly funny. */
export function passes(v?: Verdict): boolean {
  return !!v && (v.facts_cited ?? []).every((f) => f.correct) && v.makes_sense && v.wordplay && v.punchline_at_end && v.no_contradiction && v.safe && v.funny >= MIN_FUNNY;
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
      abortSignal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12_000)]) : AbortSignal.timeout(12_000),
      // Reasoning on: the judge has to list facts and owners before deciding.
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 1024 } } },
    } as Parameters<typeof generateText>[0]);
    return (res as unknown as { output?: z.infer<typeof JudgeSchema> }).output ?? null;
  } catch (e) {
    console.warn("judge failed:", (e as Error).message);
    return null;
  }
}

export function ownershipCtx(input: RoastInput): OwnershipCtx {
  const { a, b, tastesA, tastesB, entitiesA, entitiesB, score, city } = input;
  return {
    a: { nick: a.nick, tastes: entitiesA, shown: tastesA },
    b: { nick: b.nick, tastes: entitiesB, shown: tastesB },
    vocab: [city, ...score.pins.map((p) => p.name), ...score.zones.map((z) => z.zone), ...score.topTags.map((t) => t.name)],
  };
}

/** English titles often come in Title Case; lowercase everything that isn't a known proper name. */
function sentenceCaseTitle(title: string, lang: Lang, ctx: OwnershipCtx): string {
  if (lang !== "en" || !title.includes("·")) return title;
  const [label, ...rest] = title.split(" · ");
  const known = new Set([ctx.a, ctx.b].flatMap((p) => [p.nick, ...p.tastes.flatMap((e) => [e.name, e.input]), ...(p.shown ?? [])]).concat(ctx.vocab).flatMap((x) => x.split(/\s+/)).map((w) => w.toLowerCase().replace(/['’]s$/, "")));
  const tail = rest.join(" · ").split(/\s+/).map((w, i) => (i === 0 || known.has(w.toLowerCase().replace(/['’]s$/, "").replace(/[^\p{L}\p{N}]/gu, "")) ? w : w.toLowerCase())).join(" ");
  return tail.trim() ? `${label} · ${tail}`.replace(/(\s*·\s*)+$/, "") : label;
}

async function candidates(input: RoastInput, toolCalls: string[], useTools: boolean) {
  const { a, b, tastesA, tastesB, score, lang, city, signal } = input;
  const data = useTools ? "" : `\n\nDatos de Qloo (Qloo data), ya consultados: ${JSON.stringify(toolSnapshot(score, a.nick, b.nick))}`;
  const res = await generateText({
    model: modelId(),
    ...(useTools ? { tools: buildTools(score, a.nick, b.nick), stopWhen: isStepCount(4) } : {}),
    output: Output.object({ schema: RoastSchema }),
    system: systemPrompt(score.risk, lang, city, pickShots([...tastesA, ...tastesB], lang)).replace(/^(Primero llama tus herramientas|First call your tools).*$/m, useTools ? "$&" : "") + data,
    prompt: userPrompt(a, b, tastesA, tastesB, lang, sharedPairs(input.entitiesA, tastesA, tastesB)),
    temperature: 1,
    abortSignal: signal,
    providerOptions: { google: { thinkingConfig: { thinkingBudget: 512 } } },
    onStepEnd: (step: { toolCalls?: { toolName: string }[] }) => {
      for (const c of step.toolCalls ?? []) toolCalls.push(c.toolName);
    },
  } as Parameters<typeof generateText>[0]);
  const out = (res as unknown as { output?: z.infer<typeof RoastSchema> }).output;
  const people = [a, b];
  const own = ownershipCtx(input);
  const rejected: Judged[] = [];
  const cands = (out?.candidates ?? [])
    .map((c) => sanitizeRoast({ ...c, plan: "" }, score.risk, lang, score.zones[0]?.zone))
    .map((c) => ({ title: sentenceCaseTitle(c.title, lang, own), roast: fixGender(c.roast, people, lang) }))
    .filter((c) => {
      if (c.roast.split(/\s+/).length < 6 || !inLang(c.roast, lang)) {
        rejected.push({ ...c, total: -2, dropped: true, reason: "too short, wrong language or filtered" });
        return false;
      }
      const chk = checkJoke(c.title, c.roast, own);
      if (!chk.ok) rejected.push({ ...c, total: -2, dropped: true, reason: chk.reason });
      return chk.ok;
    });
  return { cands, rejected, plan: out?.plan ?? "" };
}

/**
 * Tool-calling agent writes 3 candidates; a judge (gemini-2.5-flash) checks explicit
 * criteria and ranks them. If none passes, we regenerate once (time permitting),
 * then fall back to the best-ranked sensible one, or the template.
 */
export async function generateRoast(input: RoastInput): Promise<RoastOutput> {
  const { a, b, tastesA, tastesB, entitiesA, entitiesB, score, lang } = input;
  const t0 = Date.now();
  const toolCalls: string[] = [];
  const pron = (p: Person) => (p.pronoun === "m" ? "he" : p.pronoun === "f" ? "she" : "they");
  const owns = (p: Person, es: TasteEntity[], shown: string[]) => `${p.nick} (${pron(p)}) — ONLY ${p.nick}'s tastes: ${es.map((e, i) => `${shown[i] ?? e.name} [${e.type === "tag" ? "category" : e.type}]`).join("; ")}`;
  const shared = sharedPairs(entitiesA, tastesA, tastesB);
  const context = `${owns(a, entitiesA, tastesA)}. ${owns(b, entitiesB, tastesB)}. Real places: ${score.pins.slice(0, 12).map((p) => p.name).join(", ")}. No songs, albums or characters are verified for these tastes: citing any is a fact error.${shared.length ? ` Shared tastes (BOTH own these, citing them as both's is correct): ${shared.map(([x, y]) => (x === y ? x : `${x} (${a.nick}) / ${y} (${b.nick})`)).join("; ")}.` : ""}`;

  const judged: Judged[] = [];
  let plan = "";
  let best: { title: string; roast: string } | null = null;
  for (let round = 0; round < 2 && !best; round++) {
    if (round === 1 && Date.now() - t0 > REGEN_BUDGET_MS) break;
    // Round 2 skips the tool round-trip (same Qloo data inlined) to stay within the time budget.
    const r = await candidates(input, toolCalls, round === 0);
    plan ||= r.plan;
    judged.push(...r.rejected);
    if (!r.cands.length) continue;
    // The judge sees the title punchline too, so a wrong reference there is caught as well.
    const forJudge = r.cands.map((c) => {
      const tail = c.title.split("·").slice(1).join("·").trim();
      return tail ? `Title: "${tail}" | Joke: ${c.roast}` : c.roast;
    });
    const j = await judge(lang, forJudge, context, input.signal);
    // Real places and the city never have an owner; don't let the judge fail them.
    const known = new Set(ownershipCtx(input).vocab.map(fold));
    for (const v of j?.verdicts ?? [])
      for (const f of v.facts_cited ?? [])
        if (known.has(fold(f.fact)) || fold(f.attributed_to) === fold(f.true_owner)) f.correct = true;
    // If the judge is down, the deterministic checks already passed: accept the first.
    const pick = pickBest(r.cands, j?.verdicts ?? null, j?.ranking ?? null);
    r.cands.forEach((c, i) => {
      const v = j?.verdicts.find((x) => x.index === i);
      const wrong = v?.facts_cited?.find((f) => !f.correct);
      const reason = !v ? undefined : wrong ? `judge: ${wrong.fact} is ${wrong.true_owner}'s, not ${wrong.attributed_to}'s` : passes(v) ? undefined : `judge: ${Object.entries(v).filter(([k, x]) => x === false && k !== "index").map(([k]) => k).join(", ") || `funny ${v.funny}`}`;
      judged.push({ title: c.title, roast: c.roast, total: pick.totals[i], dropped: pick.totals[i] < 0, reason });
    });
    best = pick.best;
  }
  const safe = fallbackRoast(a, b, score, lang, tastesA, tastesB, shared);
  const own = ownershipCtx(input);
  const cleanPlan = fixGender(tameAdjectives(cleanLine(plan, score.risk), lang), [a, b], lang);
  const planOk = cleanPlan && inLang(cleanPlan, lang) && checkJoke("", cleanPlan, own).ok && checkReferences(cleanPlan, own).ok;
  return {
    roast: { ...(best ?? { title: safe.title, roast: safe.roast }), plan: planOk ? cleanPlan : safe.plan },
    toolCalls,
    judged,
    usedTemplate: !best,
  };
}
