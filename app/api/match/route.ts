import { NextResponse } from "next/server";
import { resolve, places, compare } from "@/lib/qloo";
import { score } from "@/lib/score";
import { roast, fallback } from "@/lib/agent";
export const maxDuration = 60;
const clean = (s: unknown, n = 24) => String(s || "").replace(/[<>]/g, "").trim().slice(0, n);
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body.consent) return NextResponse.json({ error: "Ambos deben aceptar que esto es un chiste entre los dos." }, { status: 400 });
  const a = clean(body.a?.nick) || "A", b = clean(body.b?.nick) || "B";
  const split = (s: unknown) => String(s || "").split(/[,\n]/).map((x) => clean(x, 60)).filter(Boolean);
  try {
    const [ra, rb] = [await resolve(split(body.a?.tastes)), await resolve(split(body.b?.tastes))];
    if (!ra.found.length || !rb.found.length) return NextResponse.json({ error: "No reconocí los gustos. Prueba con artistas, películas, series o libros.", missing: [...ra.missing, ...rb.missing] }, { status: 422 });
    const ia = ra.found.map((e) => e.id), ib = rb.found.map((e) => e.id);
    const [tags, pa, pb] = await Promise.all([compare(ia, ib), places(ia), places(ib)]);
    const r = score(tags, pa, pb);
    let out, steps: string[] = [], agent = "llm";
    try { const x = await roast(a, b, ra.found.map((e) => e.name), rb.found.map((e) => e.name), r); out = x.roast; steps = x.steps; if (!out?.roast_es) throw 0; }
    catch (e) { console.error("agent", e); out = fallback(a, b, r); agent = "fallback"; }
    return NextResponse.json({ a, b, tastesA: ra.found, tastesB: rb.found, missing: [...ra.missing, ...rb.missing], ...r, roast: out, agent, toolCalls: steps });
  } catch (e: any) {
    console.error(e); return NextResponse.json({ error: "Qloo está ocupado, intenta en un momento." }, { status: 502 });
  }
}
