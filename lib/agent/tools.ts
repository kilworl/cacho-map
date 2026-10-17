import { tool } from "ai";
import { z } from "zod";
import type { ScoreResult } from "../types";

/**
 * Tools the roast agent can call. They expose the Qloo-derived score so the LLM
 * grounds every joke in real data instead of inventing places or numbers.
 */
export function buildTools(r: ScoreResult, a: string, b: string) {
  const describe = (p: ScoreResult["pins"][number]) => ({
    name: p.name,
    neighborhood: p.zone,
    kind: p.tags?.genres?.[0] ?? p.genre ?? null,
    cuisine: p.tags?.cuisines?.[0] ?? null,
  });
  return {
    getRisk: tool({
      description: "Cheating risk from Qloo place picks. CHEATING_RISK_PCT is the only percentage you may quote.",
      inputSchema: z.object({}),
      execute: async () => ({ CHEATING_RISK_PCT: r.risk, level: r.level, placesOnlyA: r.onlyA, placesOnlyB: r.onlyB, sharedPlaces: r.shared }),
    }),
    getSharedTasteTags: tool({
      description: "Qloo taste tags both people connect to, and which of their tastes triggered each tag.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(8).default(5) }),
      execute: async () => r.topTags.slice(0, 5).map((t) => ({ tag: t.name, fromA: t.a, fromB: t.b })),
    }),
    getZones: tool({
      description: "Danger zones (places only one of them likes: they'd go alone) and safe zones (both like). No numbers.",
      inputSchema: z.object({}),
      execute: async () => ({
        danger: r.zones.filter((z) => z.kind === "danger").slice(0, 3).map((z) => ({ zone: z.zone, typical: z.profile.genres, onlyA: z.onlyA?.name ?? null, onlyB: z.onlyB?.name ?? null })),
        safe: r.zones.filter((z) => z.kind === "safe").slice(0, 2).map((z) => ({ zone: z.zone, typical: z.profile.genres })),
      }),
    }),
    getPlaces: tool({
      description: `Real places from Qloo: "both" = both like it, "a" = only ${a}, "b" = only ${b}.`,
      inputSchema: z.object({ who: z.enum(["both", "a", "b"]) }),
      execute: async ({ who }) => r.pins.filter((p) => p.who === who).slice(0, 5).map(describe),
    }),
  };
}
