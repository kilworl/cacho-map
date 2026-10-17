import type { Lang, Roast, ScoreResult } from "../types";
import { pctLabel } from "./prompt";

/** Template roast used when the LLM is unavailable. Still data-driven and on-brand (light cacho wordplay). */
export function fallbackRoast(a: string, b: string, r: ScoreResult, lang: Lang): Roast {
  const label = pctLabel(r.risk, lang);
  const danger = r.zones.find((z) => z.kind === "danger")?.zone;
  const name = (who: "a" | "b" | "both") => r.pins.find((p) => p.who === who)?.name.replace(/[.\s]+$/, "");
  const onlyA = name("a");
  const onlyB = name("b");
  const both = name("both");
  if (lang === "es") {
    return {
      title: danger ? `${label} · ojo con ${danger}` : label,
      roast: onlyA && onlyB
        ? `${a} se va para ${onlyA} y ${b} para ${onlyB}. Con un ${r.risk}% de planes por separado, el cacho no es con otra persona: es con otro plan.`
        : `${a} y ${b} comparten ${r.shared} lugares. Con ${r.risk}% de riesgo de cacho, por ahora el único tercero es el celular.`,
      plan: both ? `Plan seguro, juntos: ${both}. Así nadie sale con "otra compañía".` : "Plan seguro: caminar juntos, sin coartadas.",
    };
  }
  return {
    title: danger ? `${label} · watch out for ${danger}` : label,
    roast: onlyA && onlyB
      ? `${a} heads to ${onlyA}, ${b} to ${onlyB}. With ${r.risk}% of their plans apart, the affair isn't with a person: it's with a different plan.`
      : `${a} and ${b} share ${r.shared} places. At ${r.risk}% cheating risk, the only third wheel so far is the phone.`,
    plan: both ? `Safe plan, together: ${both}. That way nobody goes out with "other company".` : "Safe plan: a walk together, no alibis needed.",
  };
}
