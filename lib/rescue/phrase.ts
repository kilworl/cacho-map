import { generateText, Output } from "ai";
import { z } from "zod";
import type { Lang, RescueStop, TasteEntity } from "../types";
import { normalizeModelId } from "../agent/model";
import { fixGender, type Person } from "../agent/gender";
import { cleanLine, inLang, tameAdjectives } from "../agent/sanitize";
import { templatePlace } from "../agent/enrich";
import { tasteName } from "../explain";
import type { Candidate } from "./pick";

const Schema = z.object({
  title: z.string().describe("max 7 words"),
  stops: z.array(z.object({ id: z.string(), line: z.string().describe("max 20 words") })),
});

export interface PhraseCtx {
  a: Person;
  b: Person;
  tastesA: TasteEntity[];
  tastesB: TasteEntity[];
  lang: Lang;
  risk: number;
}

const MAX_WORDS = 24;

/** Deterministic "what to do there" line from the place type (used when the model fails a check). */
export function templateLine(s: RescueStop, lang: Lang): string {
  return templatePlace({ ...s, who: "both", zone: s.zone ?? "", tags: { genres: s.genre ? [s.genre] : [], cuisines: [], ambience: [], activities: [] } }, lang).plan.replace(/^Plan: /, "").replace(/^\p{Ll}/u, (c) => c.toLocaleUpperCase());
}

/** A model line is kept only if it's short, in the right language, and passes the safety filters. */
export function acceptLine(text: string | undefined, ctx: PhraseCtx): string | undefined {
  if (!text) return undefined;
  const t = fixGender(tameAdjectives(cleanLine(text.replace(/[!¡]/g, ""), ctx.risk), ctx.lang), [ctx.a, ctx.b], ctx.lang).trim();
  if (!t || t.split(/\s+/).length > MAX_WORDS || !inLang(t, ctx.lang)) return undefined;
  // Lines about the people ("algo de Karol G para Karol", "que a Ana le gusta") came out as nonsense: the UI shows whose taste it is.
  const nicks = [ctx.a.nick, ctx.b.nick].filter(Boolean).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (nicks.length && new RegExp(`(^|[^\\p{L}])(${nicks.join("|")})(?![\\p{L}])`, "iu").test(t)) return undefined;
  if (/\b(le|les) (gusta|encanta)|\b(likes?|loves?)\b/iu.test(t)) return undefined;
  return t;
}

/**
 * One small model call phrases the plan: a title and one concrete line per stop,
 * grounded only in the Qloo facts we pass. Every line is checked; failures get the template.
 */
export async function phraseRescue(stops: RescueStop[], places: Map<string, Candidate>, ctx: PhraseCtx, timeoutMs = 9000): Promise<{ title: string; stops: RescueStop[]; llm: boolean }> {
  const names = (idx: number[], tastes: TasteEntity[]) => idx.map((i) => tasteName(tastes[i], ctx.lang)).filter(Boolean);
  const facts = stops.map((s) => {
    const p = places.get(s.id);
    return {
      id: s.id, name: s.name, zone: s.zone ?? null, types: p?.tags?.genres ?? [s.genre], cuisines: p?.tags?.cuisines ?? [], ambience: p?.tags?.ambience ?? [],
      [`for_${ctx.a.nick}`]: names(s.forA, ctx.tastesA), [`for_${ctx.b.nick}`]: names(s.forB, ctx.tastesB),
    };
  });
  const es = ctx.lang === "es";
  const system = `You plan a "rescue date" for a couple (${ctx.a.nick} and ${ctx.b.nick}) so they go out TOGETHER instead of each on their own. You get 2-3 real stops from Qloo with the tastes of each person each stop satisfies.
Write "title": a playful plan name, max 7 words, no names of places, no percentages.
For each stop write "line": ONE concrete thing the two of them do TOGETHER there, max 18 words, talking to them (${ctx.lang === "es" ? 'imperative "ustedes": "Vayan…", "Vean…"' : 'imperative: "Catch…", "Grab…"'}). It must fit ONLY the place's types/cuisines/ambience. Do NOT mention the people, their names or their tastes: the app already shows whose taste each stop serves.
Good: ${ctx.lang === "es" ? '"Vean una de terror y después una de k-dramas: cada uno escoge la película." / "Pidan tacos y quédense para la música en vivo."' : '"Catch a horror movie, then a K-drama: each of you picks one." / "Grab tacos and stay for the live music."'}
Bad: "order X for A and something of Y for B", "the music A likes", "try the ceviche, A likes reggaeton", ordering food that's not in cuisines, inventing sports, karaoke, events or vibes not in the data, "romantic", "perfect", "quiet". No exclamation marks or emojis.
Pronouns: ${ctx.a.nick} ${ctx.a.pronoun === "m" ? "he" : ctx.a.pronoun === "f" ? "she" : "they (neutral, no gendered words)"}; ${ctx.b.nick} ${ctx.b.pronoun === "m" ? "he" : ctx.b.pronoun === "f" ? "she" : "they (neutral, no gendered words)"}.
Everything in ${es ? "Spanish (Colombian, casual)" : "English"}. Keep the ids.`;
  let out: z.infer<typeof Schema> | undefined;
  try {
    const res = await generateText({
      model: normalizeModelId(),
      output: Output.object({ schema: Schema }),
      system,
      prompt: JSON.stringify(facts),
      temperature: 0.5,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(timeoutMs),
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    } as Parameters<typeof generateText>[0]);
    out = (res as unknown as { output?: z.infer<typeof Schema> }).output;
  } catch (e) {
    console.warn("rescue phrase fallback:", (e as Error).message);
  }
  const title = acceptLine(out?.title, ctx);
  const okTitle = title && title.split(/\s+/).length <= 9 && !/\d+\s?%/.test(title) ? title.replace(/[.]$/, "") : "";
  let llm = !!okTitle;
  const phrased = stops.map((s) => {
    const line = acceptLine(out?.stops.find((x) => x.id === s.id)?.line, ctx);
    if (!line) llm = false;
    return { ...s, line: line ?? templateLine(s, ctx.lang) };
  });
  return { title: okTitle, stops: phrased, llm };
}
