"use client";
import { useEffect, useState } from "react";
import type { CityContext } from "@/lib/types";
import { PRESET_CITIES } from "@/lib/geo/cities";
import { getPosition, reverseGeocode } from "@/lib/geo/locate";
import { useI18n } from "@/lib/i18n/LangProvider";

type Status = "idle" | "locating" | "gps" | "denied";

/** Asks for the browser location once; falls back to a city picker (Cartagena by default). */
export function LocationPicker({ city, onChange }: { city: CityContext; onChange: (c: CityContext) => void }) {
  const { t, lang } = useI18n();
  const [status, setStatus] = useState<Status>("idle");

  async function locate() {
    setStatus("locating");
    try {
      const pos = await getPosition();
      const c = await reverseGeocode(pos.coords.latitude, pos.coords.longitude, lang);
      onChange(c);
      setStatus("gps");
    } catch {
      setStatus("denied");
    }
  }

  useEffect(() => {
    // Ask on first visit; if permission was already denied, stay quiet.
    let off = false;
    (async () => {
      const perm = await navigator.permissions?.query({ name: "geolocation" }).catch(() => null);
      if (!off && perm?.state !== "denied") locate();
      else if (!off) setStatus("denied");
    })();
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const presetIdx = PRESET_CITIES.findIndex((c) => c.name === city.name);
  return (
    <div className="loc">
      <span className="loc-label">{t.where}</span>
      <select
        aria-label={t.city}
        value={status === "gps" ? "gps" : String(presetIdx < 0 ? 0 : presetIdx)}
        onChange={(e) => {
          if (e.target.value === "gps") return;
          setStatus((s) => (s === "gps" ? "idle" : s));
          onChange(PRESET_CITIES[Number(e.target.value)]);
        }}
      >
        {status === "gps" && <option value="gps">📍 {city.name} ({t.nearYou})</option>}
        {PRESET_CITIES.map((c, i) => (
          <option key={c.name} value={i}>{c.name}</option>
        ))}
      </select>
      <button type="button" className="loc-gps" onClick={locate} disabled={status === "locating"} title={t.useLocation}>
        {status === "locating" ? t.locating : `📍 ${t.useLocation}`}
      </button>
      {status === "denied" && <small className="loc-hint">{t.locDenied}</small>}
    </div>
  );
}
