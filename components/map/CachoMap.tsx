"use client";
import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoPoint, Pin, RescueStop, ZoneStat } from "@/lib/types";
import { BASEMAP_URL, HEAT_STOPS, TINT } from "./mapTheme";

// Fix for "Worker failed to load": serve MapLibre's worker as a static file (see scripts/copy-maplibre-worker.mjs).
maplibregl.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

export interface PinLabels {
  both: string;
  a: string;
  b: string;
}

interface Props {
  /** Accessible name of the map region, in the UI language. */
  label: string;
  center: GeoPoint;
  pins: Pin[];
  zones: ZoneStat[];
  labels: PinLabels;
  /** Changing this flies the camera to the point. */
  focus?: (GeoPoint & { key: string }) | null;
  /** Rescue plan: numbered stops joined by a dashed route from the couple's location. */
  route?: RescueStop[];
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function popupHtml(p: Pin, labels: PinLabels): string {
  const meta = [p.typeLabel, p.zone].filter(Boolean).map((x) => esc(String(x))).join(" · ");
  const img = p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" />` : "";
  const rating = p.rating ? `<span class="pop-rating">★ ${p.rating.toFixed(1)}</span>` : "";
  // Skip a summary that only repeats the place type already shown above it.
  const summary = p.summary && p.summary.toLowerCase() !== p.typeLabel?.toLowerCase() ? `<p class="pop-sum">${esc(p.summary)}</p>` : "";
  const plan = p.plan ? `<p class="pop-plan">${esc(p.plan)}</p>` : "";
  const why = p.why ? `<p class="pop-why">${esc(p.why)}</p>` : "";
  return `<div class="pop pop--${p.who}">${img}<div class="pop-body"><span class="pop-who">${esc(labels[p.who])}</span><strong>${esc(p.name)}</strong><small>${meta} ${rating}</small>${why}${summary}${plan}</div></div>`;
}

function zonesGeoJSON(zones: ZoneStat[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: zones.map((z) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [z.lon, z.lat] },
      properties: { zone: z.zone, clash: z.riskPct, n: z.n },
    })),
  };
}

function routeGeoJSON(start: GeoPoint, stops: RescueStop[]): GeoJSON.FeatureCollection {
  if (!stops.length) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[start.lon, start.lat], ...stops.map((s) => [s.lon, s.lat])] } }],
  };
}

export default function CachoMap({ label, center, pins, zones, labels, focus, route = [] }: Props) {
  const stopMarkers = useRef<Marker[]>([]);
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const ready = useRef<Promise<void> | null>(null);

  // Create the map once.
  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      center: [center.lon, center.lat],
      zoom: 11.5,
      attributionControl: false,
      cooperativeGestures: false,
      fadeDuration: 150,
    });
    // Drop road-shield layers: OpenFreeMap's expressions for them trigger MapLibre v6 validation warnings and we don't need them.
    m.setStyle(BASEMAP_URL, {
      transformStyle: (_prev, next) => ({ ...next, layers: next.layers.filter((l) => !/shield/.test(l.id)) }),
    });
    m.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.current = m;
    ready.current = new Promise((resolve) =>
      m.on("load", () => {
        for (const [id, color] of Object.entries(TINT)) {
          const layer = m.getLayer(id);
          if (!layer) continue;
          m.setPaintProperty(id, layer.type === "background" ? "background-color" : "fill-color", color);
        }
        m.addSource("zones", { type: "geojson", data: zonesGeoJSON([]) });
        const heat = ["interpolate", ["linear"], ["get", "clash"], ...HEAT_STOPS.flat()] as unknown as maplibregl.ExpressionSpecification;
        m.addLayer({
          id: "zone-heat",
          type: "circle",
          source: "zones",
          paint: {
            "circle-color": heat,
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, ["+", 14, ["*", 3, ["get", "n"]]], 15, ["+", 60, ["*", 12, ["get", "n"]]]],
            "circle-blur": 0.7,
            "circle-opacity": 0.45,
          },
        });
        m.addSource("rescue", { type: "geojson", data: routeGeoJSON(center, []) });
        m.addLayer({
          id: "rescue-route",
          type: "line",
          source: "rescue",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#1a1410", "line-width": 3.5, "line-dasharray": [1.2, 1.6] },
        });
        m.addLayer({
          id: "zone-label",
          type: "symbol",
          source: "zones",
          layout: { "text-field": ["get", "zone"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-offset": [0, 1.6], "text-allow-overlap": false },
          paint: { "text-color": "#1a1410", "text-halo-color": "#fff8ec", "text-halo-width": 2 },
        });
        resolve();
      }),
    );
    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map is created once; center changes are handled below
  }, []);

  // Before results: follow the selected city.
  useEffect(() => {
    if (!pins.length) map.current?.flyTo({ center: [center.lon, center.lat], zoom: 11.5, speed: 1.4 });
  }, [center.lat, center.lon, pins.length]);

  // Results: animated pins, heat layer, fly to fit.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ready.current;
      const m = map.current;
      if (!m || cancelled) return;
      markers.current.forEach((mk) => mk.remove());
      markers.current = [];
      (m.getSource("zones") as GeoJSONSource | undefined)?.setData(zonesGeoJSON(zones));
      if (!pins.length) return;
      const bounds = new maplibregl.LngLatBounds();
      pins.forEach((p, i) => {
        // MapLibre positions the marker element with `transform`, so the animated part lives in a child.
        const node = document.createElement("button");
        node.type = "button";
        node.className = `pin pin--${p.who}`;
        node.style.setProperty("--delay", `${300 + i * 35}ms`);
        node.setAttribute("aria-label", `${p.name}: ${labels[p.who]}`);
        node.innerHTML = '<span class="pin-inner"><span class="pin-pulse"></span><span class="pin-dot"></span></span>';
        const mk = new maplibregl.Marker({ element: node })
          .setLngLat([p.lon, p.lat])
          .setPopup(new maplibregl.Popup({ offset: 14, closeButton: false, maxWidth: "260px" }).setHTML(popupHtml(p, labels)))
          .addTo(m);
        markers.current.push(mk);
        bounds.extend([p.lon, p.lat]);
      });
      m.fitBounds(bounds, { padding: { top: 60, bottom: 40, left: 40, right: 40 }, maxZoom: 14.5, duration: 2200, curve: 1.6 } as maplibregl.FitBoundsOptions);
    })();
    return () => {
      cancelled = true;
    };
  }, [pins, zones, labels]);

  // Rescue route: numbered stickers on top of the pins.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ready.current;
      const m = map.current;
      if (!m || cancelled) return;
      stopMarkers.current.forEach((mk) => mk.remove());
      stopMarkers.current = [];
      (m.getSource("rescue") as GeoJSONSource | undefined)?.setData(routeGeoJSON(center, route));
      route.forEach((s, i) => {
        const node = document.createElement("div");
        node.className = "stop-marker";
        node.style.setProperty("--delay", `${900 + i * 220}ms`);
        node.innerHTML = `<span>${i + 1}</span>`;
        node.title = s.name;
        stopMarkers.current.push(new maplibregl.Marker({ element: node, anchor: "bottom" }).setLngLat([s.lon, s.lat]).addTo(m));
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [route, center]);

  // MapLibre's control tooltips are English by default; keep them in the UI language.
  useEffect(() => {
    const es = label === "Mapa";
    const set = (sel: string, txt: string) => el.current?.querySelectorAll<HTMLElement>(sel).forEach((n) => { n.title = txt; n.setAttribute("aria-label", txt); });
    set(".maplibregl-ctrl-zoom-in", es ? "Acercar" : "Zoom in");
    set(".maplibregl-ctrl-zoom-out", es ? "Alejar" : "Zoom out");
    set(".maplibregl-ctrl-attrib-button", es ? "Créditos del mapa" : "Toggle attribution");
  }, [label]);

  useEffect(() => {
    if (focus) map.current?.flyTo({ center: [focus.lon, focus.lat], zoom: 15, speed: 1.2, curve: 1.5, essential: true });
  }, [focus]);

  return <div ref={el} className="map-canvas" role="region" aria-label={label} />;
}
