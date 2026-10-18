/**
 * Tiny JSON key-value store for live sessions. Production uses a private Vercel Blob
 * store (auth via the project's env, nothing hard-coded); dev and tests use memory.
 */
export interface JsonStore {
  get<T>(key: string): Promise<T | null>;
  /** `create` = fail if the key already exists (claim-once writes). */
  put(key: string, value: unknown, opt?: { create?: boolean }): Promise<void>;
}

export class KeyExistsError extends Error {
  constructor(key: string) {
    super(`key exists: ${key}`);
  }
}

export class MemoryStore implements JsonStore {
  private data = new Map<string, string>();
  async get<T>(key: string): Promise<T | null> {
    const v = this.data.get(key);
    return v == null ? null : (JSON.parse(v) as T);
  }
  async put(key: string, value: unknown, opt: { create?: boolean } = {}): Promise<void> {
    if (opt.create && this.data.has(key)) throw new KeyExistsError(key);
    this.data.set(key, JSON.stringify(value));
  }
}

class BlobStore implements JsonStore {
  async get<T>(key: string): Promise<T | null> {
    const { get } = await import("@vercel/blob");
    try {
      // useCache false: polling must see the other person's submit right away.
      const r = await get(key, { access: "private", useCache: false });
      if (!r || r.statusCode !== 200) return null;
      return (await new Response(r.stream).json()) as T;
    } catch (e) {
      if ((e as Error).name === "BlobNotFoundError") return null;
      throw e;
    }
  }
  async put(key: string, value: unknown, opt: { create?: boolean } = {}): Promise<void> {
    const { put } = await import("@vercel/blob");
    try {
      await put(key, JSON.stringify(value), { access: "private", addRandomSuffix: false, allowOverwrite: !opt.create, contentType: "application/json" });
    } catch (e) {
      if (opt.create && /already exists/i.test((e as Error).message)) throw new KeyExistsError(key);
      throw e;
    }
  }
}

const g = globalThis as unknown as { __cachoStore?: JsonStore };

/** Blob when the project has a Blob store connected, memory otherwise (single-process dev). */
export function getStore(): JsonStore {
  g.__cachoStore ??= process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID ? new BlobStore() : new MemoryStore();
  return g.__cachoStore;
}
