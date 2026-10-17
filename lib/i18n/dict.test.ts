import { describe, expect, it } from "vitest";
import { dictionaries } from "./dict";
import { inLang } from "../agent/sanitize";
import { PLACE_KINDS } from "../places/catalog";

type Leaf = { path: string; value: unknown };
function leaves(o: unknown, path = ""): Leaf[] {
  if (o && typeof o === "object" && !Array.isArray(o)) return Object.entries(o).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  if (Array.isArray(o)) return o.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  return [{ path, value: o }];
}
/** Renders a dictionary entry: strings as is, functions called with sample arguments. */
const render = (v: unknown): string[] => {
  if (typeof v === "string") return [v];
  if (typeof v === "function") {
    const args = Array.from({ length: v.length }, (_, i) => (i % 3 === 0 ? 3 : i % 3 === 1 ? "Ana" : "Leo"));
    const out = (v as (...a: unknown[]) => unknown)(...args);
    return typeof out === "string" ? [out] : Array.isArray(out) ? out.filter((x): x is string => typeof x === "string") : [];
  }
  return [];
};

describe("dictionaries", () => {
  const es = leaves(dictionaries.es);
  const en = leaves(dictionaries.en);
  it("have exactly the same keys", () => {
    expect(en.map((l) => l.path).sort()).toEqual(es.map((l) => l.path).sort());
  });
  it("have the same kind of value and function arity for every key", () => {
    const byPath = new Map(en.map((l) => [l.path, l.value]));
    for (const l of es) {
      const other = byPath.get(l.path);
      expect(typeof other, l.path).toBe(typeof l.value);
      if (typeof l.value === "function") expect((other as () => void).length, l.path).toBe((l.value as () => void).length);
    }
  });
  it("have no empty strings", () => {
    for (const l of [...es, ...en]) if (typeof l.value === "string") expect(l.value.trim(), l.path).not.toBe("");
  });
  it("read as the right language (every sentence-length string and template)", () => {
    for (const [lang, ls] of [["es", es], ["en", en]] as const)
      for (const l of ls)
        for (const text of render(l.value))
          if (text.split(/\s+/).length >= 4) expect(inLang(text, lang), `${lang}.${l.path}: ${text}`).toBe(true);
  });
  it("every place kind has both labels", () => {
    for (const [k, v] of Object.entries(PLACE_KINDS)) {
      expect(v.es, k).toBeTruthy();
      expect(v.en, k).toBeTruthy();
    }
  });
});
