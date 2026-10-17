import { generateText, Output } from "ai";
import { z } from "zod";
import type { TasteQuery } from "../types";
import { ENTITY_TYPES, heuristicNormalize } from "./categories";
import { normalizeModelId } from "../agent/model";

const Schema = z.object({
  items: z.array(
    z.object({
      input: z.string(),
      kind: z.enum(["title", "category"]),
      query: z.string(),
      type: z.enum(ENTITY_TYPES as [string, ...string[]]).optional(),
    }),
  ),
});

const SYSTEM = `You normalize what people say they like into search queries for the Qloo taste API.
For each input return one item, same order, same "input" text:
- kind "title" if it names a specific artist, movie, TV show, book, video game, podcast or venue. "query" = its official English title or name as known internationally (e.g. "Mentalista" -> "The Mentalist", type tv_show; "Rápido y furioso" -> "Fast & Furious", type movie; "Cien años de soledad" -> "One Hundred Years of Solitude", type book; "Bad Bunny" -> "Bad Bunny", type artist). Fix obvious typos.
- kind "category" if it is a general genre, hobby, cuisine or theme (e.g. "videojuegos" -> "video games", "superhéroes" -> "superheroes", "comida mexicana" -> "mexican", "reguetón" -> "reggaeton"). "query" = short English category name, no type.`;

/**
 * Turns free-text (often Spanish) tastes into English Qloo queries using a small LLM call.
 * Falls back to a deterministic dictionary if the model is slow or unavailable.
 */
export async function normalizeTastes(inputs: string[], timeoutMs = 5000): Promise<TasteQuery[]> {
  if (!inputs.length) return [];
  try {
    const res = await generateText({
      model: normalizeModelId(),
      system: SYSTEM,
      prompt: JSON.stringify(inputs),
      output: Output.object({ schema: Schema }),
      temperature: 0,
      abortSignal: AbortSignal.timeout(timeoutMs),
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    } as Parameters<typeof generateText>[0]);
    const items = (res as unknown as { output?: z.infer<typeof Schema> }).output?.items ?? [];
    return inputs.map((input, i) => {
      const it = items.find((x) => x.input === input) ?? items[i];
      if (!it?.query) return heuristicNormalize(input);
      return { input, kind: it.kind, query: it.query.slice(0, 80), ...(it.kind === "title" && it.type ? { type: it.type as TasteQuery["type"] } : {}) };
    });
  } catch (e) {
    console.warn("normalize fallback:", (e as Error).message);
    return inputs.map(heuristicNormalize);
  }
}
