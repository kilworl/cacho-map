import type { Lang, Roast, ScoreResult } from "../types";
import { pctLabel } from "./prompt";

/** Template roast used when the LLM is unavailable. Still data-driven and on-brand. */
export function fallbackRoast(a: string, b: string, r: ScoreResult, lang: Lang): Roast {
  const label = pctLabel(r.cachos, lang);
  const zone = r.zones[0]?.zone;
  const name = (who: "a" | "b" | "both") => r.pins.find((p) => p.who === who)?.name.replace(/[.\s]+$/, "");
  const onlyA = name("a");
  const onlyB = name("b");
  const both = name("both");
  if (lang === "es") {
    return {
      title: zone ? `${label} · donde menos coinciden: ${zone}` : label,
      roast: onlyA && onlyB
        ? `${a} elegiría ${onlyA} y ${b} se iría para ${onlyB}. Con ${r.cachos}% de cachos, el que escoja el plan del sábado tiene que negociar.`
        : `${a} y ${b} comparten ${r.shared} lugares y cero playlists. ${r.cachos}% de cachos, firmado por Qloo.`,
      plan: both ? `Plan donde coinciden: ${both}. El que escoja la música paga.` : "Plan donde coinciden: caminar y que nadie ponga música.",
    };
  }
  return {
    title: zone ? `${label} · least in sync: ${zone}` : label,
    roast: onlyA && onlyB
      ? `${a} would pick ${onlyA}, ${b} would head to ${onlyB}. At ${r.cachos}% taste-cheating, whoever plans Saturday has some convincing to do.`
      : `${a} and ${b} share ${r.shared} places and zero playlists. ${r.cachos}% taste-cheating, certified by Qloo.`,
    plan: both ? `Truce plan: ${both}. Whoever picks the music pays.` : "Truce plan: a walk where nobody controls the aux.",
  };
}
