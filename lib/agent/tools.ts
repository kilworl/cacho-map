import { tool } from "ai";
import { z } from "zod";
import type { ScoreResult } from "../types";

/**
 * Tools the roast agent can call. They expose the Qloo-derived score so the LLM
 * grounds every joke in real data instead of inventing places or numbers.
 */
export function buildTools(r: ScoreResult, a: string, b: string) {
  return {
    getCompatibility: tool({
      description: "Overall Qloo-based numbers for the couple. OVERALL_CACHOS_PCT is the only percentage you may quote.",
      inputSchema: z.object({}),
      execute: async () => ({ OVERALL_CACHOS_PCT: r.cachos, compatibilityPct: r.compat, sharedPlaces: r.shared }),
    }),
    getSharedTasteTags: tool({
      description: "Qloo taste tags both people connect to, and which of their tastes triggered each tag.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(8).default(5) }),
      execute: async ({ limit }) => r.topTags.slice(0, limit).map((t) => ({ tag: t.name, fromA: t.a, fromB: t.b })),
    }),
    getZoneClashes: tool({
      description: "Neighborhoods ordered from most to least contested (where their Qloo place picks disagree). No numbers: never quote zone figures.",
      inputSchema: z.object({}),
      execute: async () => ({
        mostContested: r.zones.slice(0, 3).map((z) => ({ zone: z.zone, onlyA: z.onlyA?.name ?? null, onlyB: z.onlyB?.name ?? null })),
        leastContested: [...r.zones].sort((x, y) => x.clashPct - y.clashPct || y.n - x.n).slice(0, 2).map((z) => z.zone),
      }),
    }),
    getPlaces: tool({
      description: `Real places from Qloo: "both" = both would pick it, "a" = only ${a}, "b" = only ${b}.`,
      inputSchema: z.object({ who: z.enum(["both", "a", "b"]) }),
      execute: async ({ who }) =>
        r.pins.filter((p) => p.who === who).slice(0, 5).map((p) => ({ name: p.name, neighborhood: p.zone, kind: p.genre ?? null })),
    }),
  };
}
