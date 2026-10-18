import type { MatchResult } from "./types";
import { cardQuery } from "./card/params";

/** Query string for the share card and /r page (see lib/card/params). */
export function shareQuery(r: MatchResult): string {
  return cardQuery(r);
}
