const SMALL = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "en", "of", "the", "and", "a", "da", "do"]);

const cap = (w: string) => w.charAt(0).toLocaleUpperCase("es") + w.slice(1).toLocaleLowerCase("es");
const isAllCaps = (w: string) => /\p{Lu}/u.test(w) && w === w.toLocaleUpperCase("es") && /\p{L}{4,}/u.test(w);

/**
 * Normalizes shouty or all-lowercase place names coming from data providers:
 * "DOÑA LOLA comida del caribe" -> "Doña Lola comida del caribe",
 * "EIVISSA CARTAGENA" -> "Eivissa Cartagena", "pueblito paisa" -> "Pueblito Paisa".
 * In mixed-case names, short acronyms (KFC) and mixed-case words are left alone.
 */
export function normalizeName(raw: string): string {
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name) return name;
  const allLower = name === name.toLocaleLowerCase("es");
  const letters = name.match(/\p{L}/gu) ?? [];
  const shouty = letters.filter((c) => c !== c.toLocaleLowerCase("es")).length / (letters.length || 1) > 0.7;
  return name
    .split(" ")
    .map((w, i) => {
      if (allLower) return i > 0 && SMALL.has(w) ? w : cap(w);
      if (!isAllCaps(w) && !(shouty && /\p{L}/u.test(w) && w === w.toLocaleUpperCase("es"))) return w;
      const lower = w.toLocaleLowerCase("es");
      return i > 0 && SMALL.has(lower) ? lower : w.split(/([-'’/])/).map((p) => (/\p{L}/u.test(p) ? cap(p) : p)).join("");
    })
    .join(" ");
}
