import type { Lang, MatchResult, RiskLevel, ZoneStat } from "../types";

/** Card formats: Instagram story, feed post (also WhatsApp) and the wide X / Open Graph image. */
export const CARD_SIZES = {
  story: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1350 },
  og: { width: 1200, height: 630 },
} as const;
export type CardFormat = keyof typeof CARD_SIZES;
export const isCardFormat = (f: string | null): f is CardFormat => !!f && f in CARD_SIZES;

/** A zone on the card's mini map: position normalized to 0..1 inside the zones' bounding box. */
export interface CardZone {
  name: string;
  risk: number;
  kind: "danger" | "safe";
  x: number;
  y: number;
}

export interface CardData {
  a: string;
  b: string;
  pct: number;
  level: RiskLevel;
  city: string;
  joke: string;
  title: string;
  lang: Lang;
  zones: CardZone[];
}

const LEVELS: RiskLevel[] = ["armored", "low", "medium", "high", "cheating"];
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Up to 6 zones, placed like on the real map (north up), padded so dots stay inside. */
export function cardZones(zones: ZoneStat[]): CardZone[] {
  const zs = zones.slice(0, 6);
  if (!zs.length) return [];
  const lats = zs.map((z) => z.lat);
  const lons = zs.map((z) => z.lon);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const nx = (lon: number) => (maxLon === minLon ? 0.5 : 0.12 + 0.76 * ((lon - minLon) / (maxLon - minLon)));
  const ny = (lat: number) => (maxLat === minLat ? 0.5 : 0.12 + 0.76 * (1 - (lat - minLat) / (maxLat - minLat)));
  return zs.map((z) => ({ name: z.zone, risk: Math.round(z.riskPct), kind: z.kind, x: Math.round(nx(z.lon) * 100) / 100, y: Math.round(ny(z.lat) * 100) / 100 }));
}

const enc = (z: CardZone) => [z.name.replace(/[~|]/g, " ").slice(0, 24), z.risk, z.kind === "danger" ? "d" : "s", z.x, z.y].join("~");

/** Query string for the card image and the share page. Only nicknames, numbers, zones and the joke. */
export function cardQuery(r: MatchResult): string {
  const [, ...rest] = r.roast.title.split(" · ");
  return new URLSearchParams({
    a: r.a, b: r.b, p: String(r.risk), lv: r.level, c: r.city.name,
    z: r.zones.find((z) => z.kind === "danger")?.zone ?? "",
    h: rest.join(" · ").slice(0, 60), t: r.roast.roast.slice(0, 220), l: r.lang,
    zs: cardZones(r.zones).map(enc).join("|"),
  }).toString();
}

/** Parses (and caps) card params from any URL; unknown or missing values get safe defaults. */
export function parseCard(q: URLSearchParams): CardData {
  const g = (key: string, n: number) => (q.get(key) ?? "").replace(/[<>]/g, "").slice(0, n);
  const pct = Math.min(100, Math.max(0, Math.round(Number(g("p", 3)) || 0)));
  const lv = g("lv", 10) as RiskLevel;
  const level = LEVELS.includes(lv) ? lv : pct <= 10 ? "armored" : pct < 35 ? "low" : pct < 60 ? "medium" : pct < 80 ? "high" : "cheating";
  const zones = g("zs", 400).split("|").filter(Boolean).slice(0, 6).flatMap((s): CardZone[] => {
    const [name, risk, kind, x, y] = s.split("~");
    if (!name || [risk, x, y].some((n) => !Number.isFinite(Number(n)))) return [];
    return [{ name: name.slice(0, 24), risk: Math.round(Number(risk)), kind: kind === "s" ? "safe" : "danger", x: clamp01(Number(x)), y: clamp01(Number(y)) }];
  });
  return { a: g("a", 24), b: g("b", 24), pct, level, city: g("c", 30), joke: g("t", 220), title: g("h", 60), lang: g("l", 2) === "en" ? "en" : "es", zones };
}
