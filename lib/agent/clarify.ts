import type { FollowUp, ParsedTaste, TasteLabel } from "../types";

/** Fewer parsed tastes than this and the agent asks for more before calling Qloo. */
export const MIN_TASTES = 2;
/** With fewer tastes than this, all from one family, the agent asks for the missing family. */
export const RICH_TASTES = 3;

const isMedia = (t: ParsedTaste) => t.kind === "title" || (t.kind === "genre" && t.domain !== "food");
const isOuting = (t: ParsedTaste) => t.kind === "food" || t.kind === "activity" || t.places.length > 0;

interface Person {
  nick: string;
  tastes: ParsedTaste[];
}

/** Why one person's input is too thin to compare, or null if it's enough. */
export function thinReason(tastes: ParsedTaste[]): FollowUp["reason"] | null {
  if (tastes.length < MIN_TASTES) return "few";
  if (tastes.length >= RICH_TASTES) return null;
  if (!tastes.some(isMedia)) return "media";
  if (!tastes.some(isOuting)) return "places";
  return null;
}

const key = (l: TasteLabel) => l.en.toLowerCase();

/**
 * The agent's "ask before computing" policy: if a person gave too little to compare
 * fairly (one taste, or two of the same family), it asks one short question about
 * that person instead of guessing. Sides in `skip` were already asked once.
 */
export function followUp(a: Person, b: Person, skip: ("a" | "b")[] = []): FollowUp | null {
  for (const [who, me, other] of [["a", a, b], ["b", b, a]] as const) {
    if (skip.includes(who)) continue;
    const reason = thinReason(me.tastes);
    if (!reason) continue;
    const mine = new Set(me.tastes.map((t) => key(t.label)));
    const fromOther = other.tastes
      .filter((t) => !mine.has(key(t.label)))
      .filter((t) => reason === "few" || (reason === "media" ? isMedia(t) : isOuting(t)))
      .slice(0, 3)
      .map((t) => ({ es: t.label.es, en: t.label.en }));
    return { who, nick: me.nick, reason, have: me.tastes.map((t) => ({ es: t.label.es, en: t.label.en })), fromOther };
  }
  return null;
}
