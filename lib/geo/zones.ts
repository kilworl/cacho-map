import type { CityContext, Lang, Place, ZonedPlace } from "../types";
import { distanceM, isCartagena } from "./cities";
import { normalizeName } from "../text/titleCase";

/**
 * Hand-placed Cartagena neighborhood centroids (our own approximations, not Qloo data).
 * Only used to refine places that come without a neighborhood when the city is Cartagena.
 */
export const CARTAGENA_ZONES: [string, number, number][] = [
  ["Centro", 10.4236, -75.5513], ["Getsemaní", 10.4205, -75.5465], ["San Diego", 10.4278, -75.548],
  ["Bocagrande", 10.399, -75.556], ["Castillogrande", 10.392, -75.549], ["El Laguito", 10.396, -75.564],
  ["Manga", 10.413, -75.537], ["Marbella", 10.437, -75.538], ["El Cabrero", 10.433, -75.544],
  ["Crespo", 10.445, -75.515], ["Pie de la Popa", 10.42, -75.53], ["Torices", 10.433, -75.53],
  ["El Bosque", 10.402, -75.515], ["La Boquilla", 10.48, -75.495], ["Zona Norte", 10.515, -75.48],
  ["Tierra Bomba", 10.37, -75.58], ["Barú", 10.2, -75.62], ["Turbaco", 10.33, -75.41], ["Mamonal", 10.33, -75.5],
];

const PREFIX = /^(upzs?\s+(localidad\s+)?|localidad\s+|colonia\s+|barrio\s+|comuna\s+\d+\s*[-–]?\s*|bairro\s+|distrito\s+)/i;

/** "UPZ Jardín Botánico" -> "Jardín Botánico", "Colonia Condesa" -> "Condesa". */
export function cleanNeighborhood(raw: string | undefined, cityName?: string): string | undefined {
  if (!raw) return undefined;
  const s = normalizeName(raw.replace(PREFIX, "").replace(/\s*[-–]\s*/g, "-").trim());
  if (!s || s.length > 40) return undefined;
  if (cityName && s.localeCompare(cityName, "es", { sensitivity: "base" }) === 0) return undefined;
  return s;
}

const SIDES: Record<Lang, string[]> = {
  es: ["Sector norte", "Sector oriente", "Sector sur", "Sector occidente", "Sector centro"],
  en: ["North side", "East side", "South side", "West side", "Downtown"],
};

/** Coarse compass sector relative to the city center: last-resort zone name. */
export function compassZone(p: { lat: number; lon: number }, center: CityContext, lang: Lang): string {
  if (distanceM(p, center) < 1500) return SIDES[lang][4];
  const ang = (Math.atan2(p.lat - center.lat, p.lon - center.lon) * 180) / Math.PI; // 0 = east
  const idx = ang >= 45 && ang < 135 ? 0 : ang >= -45 && ang < 45 ? 1 : ang >= -135 && ang < -45 ? 2 : 3;
  return SIDES[lang][idx];
}

function nearestCartagena(p: { lat: number; lon: number }): string | undefined {
  let best: string | undefined;
  let bd = 3000;
  for (const [n, lat, lon] of CARTAGENA_ZONES) {
    const d = distanceM(p, { lat, lon });
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

/**
 * Assigns every place to a zone, generically for any city:
 * 1. the neighborhood Qloo reports for the place,
 * 2. (Cartagena only) our neighborhood centroid list,
 * 3. the zone of the nearest named place within 1.2 km,
 * 4. a compass sector of the city.
 */
export function assignZones(places: Place[], city: CityContext, lang: Lang): ZonedPlace[] {
  const cart = isCartagena(city);
  const first = places.map((p) => ({ ...p, zone: cleanNeighborhood(p.neighborhood, city.name) ?? (cart ? nearestCartagena(p) : undefined) }));
  const named = first.filter((p): p is typeof p & { zone: string } => !!p.zone);
  return first.map((p) => {
    if (p.zone) return p as ZonedPlace;
    let zone: string | undefined;
    let bd = 1200;
    for (const q of named) {
      const d = distanceM(p, q);
      if (d < bd) { bd = d; zone = q.zone; }
    }
    return { ...p, zone: zone ?? compassZone(p, city, lang) };
  });
}
