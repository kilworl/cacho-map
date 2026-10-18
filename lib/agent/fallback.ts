import type { Lang, Roast, ScoreResult, TasteEntity } from "../types";
import { pctLabel } from "./prompt";
import type { Person } from "./gender";

const list = (xs: string[], lang: Lang) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${lang === "es" ? "y" : "and"} ${xs.at(-1)}`);

/** Shared taste pairs as [A's label, B's label], from the `pair` links set by lib/tastes/dedupe. */
export function sharedPairs(entitiesA: TasteEntity[], tastesA: string[], tastesB: string[]): [string, string][] {
  return entitiesA.flatMap((e, i): [string, string][] => (e.pair != null && tastesA[i] && tastesB[e.pair] ? [[tastesA[i], tastesB[e.pair]]] : []));
}

/**
 * Safe template roast (LLM down, or every candidate failed the checks). Each taste is
 * named next to its owner, so attribution is right by construction.
 */
export function fallbackRoast(pa: Person, pb: Person, r: ScoreResult, lang: Lang, tastesA: string[] = [], tastesB: string[] = [], shared: [string, string][] = []): Roast {
  const a = pa.nick;
  const b = pb.nick;
  const label = pctLabel(r.risk, lang);
  const both = r.pins.find((p) => p.who === "both")?.name.replace(/[.\s]+$/, "");
  const ta = list(tastesA.slice(0, 2), lang);
  const tb = list(tastesB.slice(0, 2), lang);
  // Armored couple (<= 10%): "ni el cacho los separa", naming a taste they really share, each next to its owner.
  if (r.level === "armored") {
    const [x, y] = shared[0] ?? [];
    const same = x && y && x.toLowerCase() === y.toLowerCase();
    if (lang === "es") {
      const why = !x ? `comparten casi todos sus planes` : same ? `a los dos les gusta ${x}` : `a ${a} le gusta ${x} y a ${b}, ${y}`;
      return {
        title: `${label} · Ni el cacho los separa`,
        roast: `${why.charAt(0).toUpperCase()}${why.slice(1)}: con gustos tan parecidos, ni el cacho los separa. Si alguno sale, es con el otro.`,
        plan: both ? `Plan de pareja blindada: ${both}, juntos como siempre.` : "Plan de pareja blindada: salir juntos, como siempre.",
      };
    }
    const why = !x ? `${a} and ${b} share almost all their plans` : same ? `${a} and ${b} both love ${x}` : `${a} is into ${x} and ${b} into ${y}`;
    return {
      title: `${label} · Not even a cacho can split them`,
      roast: `${why}: with tastes this close, not even a cacho can split them. If one goes out, it's with the other.`,
      plan: both ? `Armored-couple plan: ${both}, together as usual.` : "Armored-couple plan: go out together, as usual.",
    };
  }
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
