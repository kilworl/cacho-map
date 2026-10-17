import type { CityContext } from "../types";

/** Fallback cities when the browser won't share a location. Cartagena is the default. */
export const PRESET_CITIES: CityContext[] = [
  { name: "Cartagena", country: "Colombia", lat: 10.4236, lon: -75.5453 },
  { name: "Bogotá", country: "Colombia", lat: 4.6534, lon: -74.0628 },
  { name: "Medellín", country: "Colombia", lat: 6.2442, lon: -75.5812 },
  { name: "Barranquilla", country: "Colombia", lat: 10.9878, lon: -74.7889 },
  { name: "Cali", country: "Colombia", lat: 3.4516, lon: -76.532 },
  { name: "Santa Marta", country: "Colombia", lat: 11.2408, lon: -74.199 },
  { name: "Ciudad de México", country: "México", lat: 19.4326, lon: -99.1332 },
  { name: "Madrid", country: "España", lat: 40.4168, lon: -3.7038 },
  { name: "Miami", country: "USA", lat: 25.7617, lon: -80.1918 },
  { name: "New York", country: "USA", lat: 40.7128, lon: -74.006 },
];

export const DEFAULT_CITY = PRESET_CITIES[0];

const R = 6371e3;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in meters. */
export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const isCartagena = (c: { lat: number; lon: number }) => distanceM(c, DEFAULT_CITY) < 25_000;
