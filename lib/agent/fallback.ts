import type { Lang, Roast, ScoreResult } from "../types";
import { pctLabel } from "./prompt";
import type { Person } from "./gender";

const list = (xs: string[], lang: Lang) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${lang === "es" ? "y" : "and"} ${xs.at(-1)}`);

/**
 * Safe template roast (LLM down, or every candidate failed the checks). Each taste is
 * named next to its owner, so attribution is right by construction.
 */
export function fallbackRoast(pa: Person, pb: Person, r: ScoreResult, lang: Lang, tastesA: string[] = [], tastesB: string[] = []): Roast {
  const a = pa.nick;
  const b = pb.nick;
  const label = pctLabel(r.risk, lang);
  const both = r.pins.find((p) => p.who === "both")?.name.replace(/[.\s]+$/, "");
  const ta = list(tastesA.slice(0, 2), lang);
  const tb = list(tastesB.slice(0, 2), lang);
  if (lang === "es") {
    return {
      title: `${label} · cada quien con su plan`,
      roast: ta && tb
        ? `A ${a} le gusta ${ta} y a ${b}, ${tb}. Con un ${r.risk}% de planes por separado, el cacho no sería con otra persona: sería con otro plan.`
        : `${a} y ${b} comparten ${r.shared} lugares. Con ${r.risk}% de riesgo de cacho, por ahora el único tercero es el celular.`,
      plan: both ? `Plan seguro, juntos: ${both}. Así nadie sale con otra compañía.` : "Plan seguro: caminar juntos, sin coartadas.",
    };
  }
  return {
    title: `${label} · each with their own plan`,
    roast: ta && tb
      ? `${a} is into ${ta}, ${b} is into ${tb}. With ${r.risk}% of their plans apart, the affair isn't with a person: it's with a different plan.`
      : `${a} and ${b} share ${r.shared} places. At ${r.risk}% cheating risk, the only third wheel so far is the phone.`,
    plan: both ? `Safe plan, together: ${both}. That way nobody goes out with other company.` : "Safe plan: a walk together, no alibis needed.",
  };
}
