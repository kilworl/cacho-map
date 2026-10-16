const BASE = process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com";
const cache = new Map<string, { t: number; v: any }>();
const TTL = 24 * 3600 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function qloo(path: string, params: Record<string, string | number>) {
  const url = BASE + path + "?" + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  let last = "";
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { headers: { "X-Api-Key": process.env.QLOO_API_KEY || "" }, next: { revalidate: 86400 } });
    if (r.ok) { const v = await r.json(); cache.set(url, { t: Date.now(), v }); return v; }
    last = `${r.status}`;
    if (r.status !== 429 && r.status < 500) break;
    await sleep(800 * 2 ** i);
  }
  throw new Error(`Qloo ${path} failed: ${last}`);
}
const ents = (d: any): any[] => (Array.isArray(d?.results) ? d.results : d?.results?.entities) || [];

export type Ent = { id: string; name: string; type: string };
const TYPES = ["urn:entity:artist", "urn:entity:movie", "urn:entity:book", "urn:entity:tv_show", "urn:entity:place"].join(",");
export async function resolve(terms: string[]): Promise<{ found: Ent[]; missing: string[] }> {
  const found: Ent[] = []; const missing: string[] = [];
  for (const q of terms.slice(0, 6)) {
    try {
      const e = ents(await qloo("/search", { query: q, types: TYPES, take: 3 }))[0];
      if (e) found.push({ id: e.entity_id, name: e.name, type: (e.types?.[0] || e.subtype || "").replace("urn:entity:", "") });
      else missing.push(q);
    } catch { missing.push(q); }
  }
  return { found, missing };
}

export type Place = { id: string; name: string; lat: number; lon: number; aff: number };
export async function places(ids: string[]): Promise<Place[]> {
  const d = await qloo("/v2/insights", { "filter.type": "urn:entity:place", "filter.location.query": "Cartagena De Indias", "signal.interests.entities": ids.join(","), take: 50 });
  return ents(d).filter((e) => e.location?.lat).map((e) => ({ id: e.entity_id, name: e.name, lat: e.location.lat, lon: e.location.lon, aff: e.query?.affinity ?? 0 }));
}

export type Tag = { name: string; score: number; a: string[]; b: string[] };
export async function compare(a: string[], b: string[]): Promise<Tag[]> {
  const d = await qloo("/v2/insights/compare", { "a.signal.interests.entities": a.join(","), "b.signal.interests.entities": b.join(",") });
  return (d?.results?.tags || []).map((t: any) => ({
    name: t.name, score: t.query?.score ?? 0,
    a: (t.query?.["a.signal.interests.entities"] || []).map((x: any) => x.name),
    b: (t.query?.["b.signal.interests.entities"] || []).map((x: any) => x.name),
  }));
}
