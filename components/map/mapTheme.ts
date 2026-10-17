/**
 * Basemap + palette for the map. OpenFreeMap vector tiles (free, no key), recolored to the app palette.
 * The style ships its own attribution (OpenFreeMap, OpenMapTiles, OpenStreetMap), shown by AttributionControl.
 */
export const BASEMAP_URL = "https://tiles.openfreemap.org/styles/positron";

/** Layer id -> fill/background color overrides applied after the style loads. */
export const TINT: Record<string, string> = {
  background: "#f6ecd9",
  park: "#d3e8b8",
  water: "#86d3df",
  landuse_residential: "#f1e4cc",
  landcover_wood: "#c9e2ae",
  building: "#ecdcc0",
  road_area_pier: "#f6ecd9",
};

export const WHO_COLOR = { both: "#12b76a", a: "#ff3b1f", b: "#2563ff" } as const;

/** Zone heat color: low disagreement = green, high = hot red. */
export const HEAT_STOPS: [number, string][] = [
  [0, "#12b76a"],
  [50, "#ffc21a"],
  [100, "#ff3b1f"],
];
