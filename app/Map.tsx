"use client";
import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
type Pin = { name: string; lat: number; lon: number; who: string; zone: string };
export default function Map({ pins, a, b }: { pins: Pin[]; a: string; b: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current, center: [-75.535, 10.41], zoom: 11.5,
      style: { version: 8, sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' } }, layers: [{ id: "osm", type: "raster", source: "osm" }] },
    });
    m.addControl(new maplibregl.AttributionControl({ compact: false }));
    const bounds = new maplibregl.LngLatBounds();
    for (const p of pins) {
      const color = p.who === "both" ? "#16a34a" : "#dc2626";
      const label = p.who === "both" ? "Coinciden 💚" : `Solo ${p.who === "a" ? a : b} 🦌`;
      new maplibregl.Marker({ color }).setLngLat([p.lon, p.lat]).setPopup(new maplibregl.Popup().setText(`${p.name} · ${p.zone} · ${label}`)).addTo(m);
      bounds.extend([p.lon, p.lat]);
    }
    if (!bounds.isEmpty()) m.fitBounds(bounds, { padding: 40, maxZoom: 14 });
    return () => m.remove();
  }, [pins, a, b]);
  return <div ref={el} style={{ height: 380, borderRadius: 16, overflow: "hidden" }} />;
}
