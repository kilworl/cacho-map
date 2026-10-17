import type { MatchResult } from "./types";

/** Query string for the share card and /r page. Only nicknames, numbers and the roast are included. */
export function shareQuery(r: MatchResult): string {
  return new URLSearchParams({
    a: r.a,
    b: r.b,
    p: String(r.cachos),
    z: r.zones[0]?.zone ?? "",
    c: r.city.name,
    t: r.roast.roast.slice(0, 220),
    l: r.lang,
  }).toString();
}
