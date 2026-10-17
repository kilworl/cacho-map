/**
 * Minimal Qloo HTTP client: retries 429/5xx with exponential backoff and keeps a
 * 24 h in-memory cache per serverless instance (plus Next's fetch cache).
 */
export type QlooParams = Record<string, string | number>;

const TTL_MS = 24 * 3600 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class QlooError extends Error {
  constructor(public path: string, public status: string) {
    super(`Qloo ${path} failed: ${status}`);
  }
}

export async function qlooGet<T = unknown>(path: string, params: QlooParams, retries = 4): Promise<T> {
  const base = process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com";
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const url = `${base}${path}?${qs}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;

  let status = "network";
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: { "X-Api-Key": process.env.QLOO_API_KEY ?? "" }, next: { revalidate: 86400 } });
      if (res.ok) {
        const value = (await res.json()) as T;
        cache.set(url, { at: Date.now(), value });
        return value;
      }
      status = String(res.status);
      if (res.status !== 429 && res.status < 500) break;
    } catch {
      status = "network";
    }
    if (i < retries) await sleep(500 * 2 ** i);
  }
  throw new QlooError(path, status);
}
