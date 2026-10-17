const SMALL = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "en", "of", "the", "and", "a", "da", "do"]);

/** Roman numerals stay uppercase ("Juan XXIII", "Pío XII"); 2+ letters so "mi"/"di"/"I" aren't touched. */
const ROMAN = /^(?=[ivxlc]{2,}$)c{0,3}(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;
const isRoman = (w: string) => ROMAN.test(w) && !/^(vi|li|lix|civ|ci)$/i.test(w);
const cap = (w: string) => (isRoman(w) ? w.toUpperCase() : w.charAt(0).toLocaleUpperCase("es") + w.slice(1).toLocaleLowerCase("es"));
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
      if (i > 0 && isRoman(w)) return w.toUpperCase();
      if (allLower) return i > 0 && SMALL.has(w) ? w : cap(w);
      if (!isAllCaps(w) && !(shouty && /\p{L}/u.test(w) && w === w.toLocaleUpperCase("es"))) return w;
      const lower = w.toLocaleLowerCase("es");
      return i > 0 && SMALL.has(lower) ? lower : w.split(/([-'’/])/).map((p) => (/\p{L}/u.test(p) ? cap(p) : p)).join("");
    })
    .join(" ");
}
