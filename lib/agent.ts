import { generateText, tool, isStepCount, Output } from "ai";
import { z } from "zod";
import type { score } from "./score";
type R = ReturnType<typeof score>;
const Roast = z.object({ titulo: z.string(), roast_es: z.string(), roast_en: z.string(), plan_juntos_es: z.string() });
export type RoastT = z.infer<typeof Roast>;

export function fallback(a: string, b: string, r: R): RoastT {
  const z = r.zones[0]?.zone || "el Centro";
  return {
    titulo: `${r.cachos}% de cachos en ${z}`,
    roast_es: `${a} y ${b}: sus gustos se cruzan en ${r.shared} lugares de Cartagena. El resto del tiempo cada uno arrastra al otro a ${z}. Sobreviven, pero con playlist separada.`,
    roast_en: `${a} & ${b}: your tastes overlap in ${r.shared} Cartagena spots. The rest of the time one of you drags the other to ${z}. You'll survive — with separate playlists.`,
    plan_juntos_es: r.pins.find((p) => p.who === "both")?.name ? `Plan seguro: ${r.pins.find((p) => p.who === "both")!.name}.` : "Plan seguro: una caminata por la muralla.",
  };
}

export async function roast(a: string, b: string, ta: string[], tb: string[], r: R): Promise<{ roast: RoastT; steps: string[] }> {
  const steps: string[] = [];
  const tools = {
    getCompatibility: tool({ description: "Overall Qloo-based compatibility numbers for the couple", inputSchema: z.object({}),
      execute: async () => ({ compat: r.compat, cachos: r.cachos, tagScore: r.tagScore, placeScore: r.placeScore, sharedPlaces: r.shared }) }),
    getSharedTasteTags: tool({ description: "Qloo taste tags both people connect to, with which of their tastes caused each", inputSchema: z.object({ limit: z.number().max(8) }),
      execute: async ({ limit }) => r.topTags.slice(0, limit) }),
    getZoneClashes: tool({ description: "Cartagena neighborhoods ranked by % of disagreement (cachos) between their Qloo place recommendations", inputSchema: z.object({}),
      execute: async () => r.zones.slice(0, 5) }),
    getPlaces: tool({ description: "Places in Cartagena: where both agree, or that only one would choose", inputSchema: z.object({ who: z.enum(["both", "a", "b"]) }),
      execute: async ({ who }) => r.pins.filter((p) => p.who === who).slice(0, 5).map((p) => `${p.name} (${p.zone})`) }),
  };
  const res = await generateText({
    model: process.env.AI_MODEL || "openai/gpt-5-mini",
    tools, stopWhen: isStepCount(6), output: Output.object({ schema: Roast }),
    system: `Eres "Cacho-Map", un comediante costeño de Cartagena. Usa SIEMPRE tus herramientas (datos de Qloo) antes de escribir.
Escribe un roast corto (máx 60 palabras), juguetón y cariñoso sobre la compatibilidad de GUSTOS de la pareja, mencionando el % de cachos y una zona real de Cartagena y un lugar concreto.
"Cachos" es una broma sobre gustos incompatibles, NUNCA una acusación real de infidelidad.
Prohibido: cuerpo, sexualidad, raza, religión, política, insultos, groserías, mencionar terceras personas reales, hablar mal de un negocio.
titulo: frase corta tipo "62% de cachos en Getsemaní". roast_en: traducción natural al inglés. plan_juntos_es: un plan en un lugar donde ambos coinciden.`,
    prompt: `Persona A: "${a}" le gusta: ${ta.join(", ")}. Persona B: "${b}" le gusta: ${tb.join(", ")}.`,
    onStepEnd: (s: any) => { for (const c of s.toolCalls || []) steps.push(c.toolName); },
  } as any);
  return { roast: (res as any).output as RoastT, steps };
}
