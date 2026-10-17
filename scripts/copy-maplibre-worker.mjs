// MapLibre v6 loads its web worker from a URL relative to the bundle, which breaks
// once Next.js re-chunks the library ("Worker failed to load"). We copy the
// self-contained worker into /public and point MapLibre at it with setWorkerUrl().
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/dist/maplibre-gl.mjs"));
mkdirSync("public/vendor", { recursive: true });
copyFileSync(join(dist, "maplibre-gl-worker.mjs"), "public/vendor/maplibre-gl-worker.mjs");
console.log("maplibre worker -> public/vendor/maplibre-gl-worker.mjs");
