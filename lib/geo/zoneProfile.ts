import type { Pin, ZoneProfile } from "../types";

const GENERIC = new Set(["Place", "Tourist attraction", "Point of interest", "Establishment"]);

function top(values: (string | undefined)[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const v of values) if (v && !GENERIC.has(v)) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, n).map(([k]) => k);
}

/** Aggregates the Qloo tags of a zone's places into facts (dominant types, cuisines, vibe, price). */
export function zoneProfile(pins: Pin[]): ZoneProfile {
  const prices = pins.map((p) => p.priceLevel).filter((x): x is number => typeof x === "number");
  return {
    genres: top(pins.flatMap((p) => p.tags?.genres ?? [p.genre]), 3),
    cuisines: top(pins.flatMap((p) => p.tags?.cuisines ?? []), 3),
    ambience: top(pins.flatMap((p) => p.tags?.ambience ?? []), 3),
    ...(prices.length && { avgPrice: Math.round((prices.reduce((s, x) => s + x, 0) / prices.length) * 10) / 10 }),
  };
}
