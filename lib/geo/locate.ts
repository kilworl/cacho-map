"use client";
import type { CityContext, Lang } from "../types";

/** Browser geolocation as a promise. */
export function getPosition(timeoutMs = 8000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 600_000 });
  });
}

interface BdcResponse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
}

/** Reverse-geocodes with BigDataCloud's free client-side endpoint (no key, meant for browsers). */
export async function reverseGeocode(lat: number, lon: number, lang: Lang): Promise<CityContext> {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${lang}`;
  try {
    const d = (await (await fetch(url)).json()) as BdcResponse;
    return { name: d.city || d.locality || d.principalSubdivision || "?", country: d.countryName, lat, lon };
  } catch {
    return { name: "?", lat, lon };
  }
}
