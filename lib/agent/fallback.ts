import type { Lang, Roast, ScoreResult } from "../types";
import { pctLabel } from "./prompt";

/** Template roast used when the LLM is unavailable. Still data-driven and on-brand. */
export function fallbackRoast(a: string, b: string, r: ScoreResult, lang: Lang): Roast {
  const label = pctLabel(r.cachos, lang);
  const zone = r.zones[0]?.zone;
  const onlyA = r.pins.find((p) => p.who === "a")?.name;
  const onlyB = r.pins.find((p) => p.who === "b")?.name;
  const both = r.pins.find((p) => p.who === "both")?.name;
  if (lang === "es") {
    return {
      title: zone ? `${label} · la pelea es en ${zone}` : label,
      roast: onlyA && onlyB
        ? `${a} propone ${onlyA}, ${b} contraataca con ${onlyB}. ${r.cachos}% de cachos: no es una pareja, es una negociación sindical.`
        : `${a} y ${b} comparten ${r.shared} lugares y cero playlists. ${r.cachos}% de cachos, firmado por Qloo.`,
      plan: both ? `Plan sin pelea: ${both}. El que escoja la música paga.` : "Plan sin pelea: caminar y que nadie ponga música.",
    };
  }
  return {
    title: zone ? `${label} · ${zone} is the battlefield` : label,
    roast: onlyA && onlyB
      ? `${a} suggests ${onlyA}, ${b} counters with ${onlyB}. ${r.cachos}% taste-cheating: less a couple, more a hostage negotiation.`
      : `${a} and ${b} share ${r.shared} places and zero playlists. ${r.cachos}% taste-cheating, certified by Qloo.`,
    plan: both ? `Truce plan: ${both}. Whoever picks the music pays.` : "Truce plan: a walk where nobody controls the aux.",
  };
}
