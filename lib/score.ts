import type { Place, Tag } from "./qloo";
// Our own approximate neighborhood centroids (not Qloo data)
export const ZONES: [string, number, number][] = [
  ["Centro", 10.4236, -75.5513], ["Getsemaní", 10.4205, -75.5465], ["San Diego", 10.4278, -75.5480],
  ["Bocagrande", 10.3990, -75.5560], ["Castillogrande", 10.3920, -75.5490], ["Manga", 10.4130, -75.5370],
  ["Crespo", 10.4450, -75.5150], ["Pie de la Popa", 10.4200, -75.5300], ["La Boquilla", 10.4800, -75.4950],
  ["Barú / Islas", 10.2000, -75.6200], ["Resto de la ciudad", 10.3950, -75.4900],
];
export function zoneOf(lat: number, lon: number) {
  let best = ZONES[0][0], bd = Infinity;
  for (const [n, a, o] of ZONES) { const d = (lat - a) ** 2 + (lon - o) ** 2; if (d < bd) { bd = d; best = n; } }
  return bd > 0.0016 && best !== "Barú / Islas" ? "Resto de la ciudad" : best;
}
export type Pin = { name: string; lat: number; lon: number; who: "both" | "a" | "b"; zone: string };
export function score(tags: Tag[], pa: Place[], pb: Place[]) {
  const scores = tags.map((t) => t.score);
  const mean = scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : 0.5;
  const tagScore = Math.max(0, Math.min(100, ((mean - 0.5) / 0.23) * 100)) * Math.min(1, scores.length / 40);
  const ta = pa.slice(0, 25), tb = pb.slice(0, 25);
  const ia = new Set(ta.map((p) => p.id)), ib = new Set(tb.map((p) => p.id));
  const inter = [...ia].filter((x) => ib.has(x)).length;
  const uni = new Set([...ia, ...ib]).size || 1;
  const placeScore = (inter / uni) * 100;
  const compat = Math.round(0.6 * tagScore + 0.4 * placeScore);
  const all = new Map<string, Pin>();
  for (const p of ta) all.set(p.id, { name: p.name, lat: p.lat, lon: p.lon, who: ib.has(p.id) ? "both" : "a", zone: zoneOf(p.lat, p.lon) });
  for (const p of tb) if (!all.has(p.id)) all.set(p.id, { name: p.name, lat: p.lat, lon: p.lon, who: "b", zone: zoneOf(p.lat, p.lon) });
  const pins = [...all.values()];
  const z = new Map<string, { both: number; clash: number }>();
  for (const p of pins) { const v = z.get(p.zone) || { both: 0, clash: 0 }; p.who === "both" ? v.both++ : v.clash++; z.set(p.zone, v); }
  const zones = [...z.entries()].map(([zone, v]) => ({ zone, cachos: Math.round((v.clash / (v.both + v.clash)) * 100), n: v.both + v.clash }))
    .sort((x, y) => y.cachos * y.n - x.cachos * x.n);
  const topTags = [...tags].sort((x, y) => y.score - x.score).slice(0, 8);
  return { compat, cachos: 100 - compat, tagScore: Math.round(tagScore), placeScore: Math.round(placeScore), shared: inter, pins, zones, topTags };
}
