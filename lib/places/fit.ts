/**
 * Does a Qloo place really fit the taste that brought it? Filtering /v2/insights by a place
 * kind is OR-based and Qloo tags are loose, so a café list pulled in supermarkets and
 * seafood restaurants (both carry a "coffee shop" tag), UFC pulled in baseball stadiums
 * and Metallica pulled in salsa bars. These checks drop such places from that taste's list.
 */
import { foldText } from "../tastes/match";
import { PLACE_KINDS, type PlaceKind } from "./catalog";

/** Never a "por esto" place even when it carries the asked tag (a supermarket with a coffee corner). */
const NOT_A_PLAN = /supermarket|grocery|hypermarket|convenience store|department store|pharmac|drugstore|gas station|\bbank\b|hospital|clinic/i;
/** A whole mall isn't a gym or a café ("Centro Comercial Nao" tagged gym). */
const MALL_NAME = /^(centro comercial|c\.? ?c\.? |mall\b)/i;

/** Per kind: other genres that mean it's really a different kind of place. */
const KIND_EXCLUDE: Partial<Record<PlaceKind, RegExp>> = {
  cafe: /seafood|fish|steak|grill|wine store|liquor|butcher|night ?club|pizza/i,
  bakery: /seafood|fish|steak|grill|liquor|night ?club/i,
  bookstore: /stationery|office supply|supermarket/i,
};

/** Words that pin a place to one music genre or one sport. Same family + different word = conflict. */
const FAMILIES: Record<string, Record<string, RegExp>> = {
  music: {
    salsa: /\bsalsa\b/, vallenato: /vallenat/, champeta: /champeta/, reggaeton: /reggaeton|regueton|reguet/, rock: /\brock\b|\bmetal\b/,
    jazz: /\bjazz\b/, blues: /\bblues\b/, electronic: /electro|techno/, hiphop: /hip ?hop|\brap\b/, bachata: /bachata/, merengue: /merengue/,
    cumbia: /cumbia/, tango: /\btango\b/, karaoke: /karaoke/, kpop: /k ?pop/, folk: /\bfolk\b/, disco: /\bdisco\b(?! ?club)/, country: /\bcountry\b/,
  },
  sport: {
    football: /futbol|soccer|\bfootball\b/, baseball: /baseball|beisbol/, basketball: /basket|baloncesto/, combat: /\bufc\b|\bmma\b|combat|boxing|boxeo|lucha|martial/,
    tennis: /\btenn?is\b/, golf: /\bgolf\b/, cycling: /cycling|ciclismo/,
  },
};

const hits = (text: string, fam: Record<string, RegExp>) => Object.entries(fam).filter(([, re]) => re.test(text)).map(([k]) => k);

/** Music genres / sports a taste is about (from its words and Qloo's facts, e.g. Metallica -> rock). */
export function tasteTopics(text: string): Record<string, string[]> {
  const t = foldText(text);
  return Object.fromEntries(Object.entries(FAMILIES).map(([f, fam]) => [f, hits(t, fam)]));
}

export interface PlaceFacts {
  name: string;
  /** All Qloo place-genre names (and other tag names) of the place. */
  genres: string[];
  /** Qloo tag ids, to know which of the asked kinds the place matched. */
  tagIds?: string[];
}

/** True if the place fits a taste with these place kinds and topics. */
export function fitsTaste(p: PlaceFacts, kinds: readonly PlaceKind[], topics: Record<string, string[]>): boolean {
  const g = p.genres.join(" | ");
  if (NOT_A_PLAN.test(g)) return false;
  if (MALL_NAME.test(p.name) && !kinds.includes("mall")) return false;
  // Every asked kind the place matched rejects it -> it's really another kind of place
  // (a seafood restaurant with a coffee-shop tag isn't a café for a book lover).
  const ids = new Set(p.tagIds ?? []);
  const matched = p.tagIds ? kinds.filter((k) => PLACE_KINDS[k].tags.some((t) => ids.has(`urn:tag:genre:place:${t}`))) : kinds;
  if (matched.length && matched.every((k) => KIND_EXCLUDE[k]?.test(g))) return false;
  const text = foldText(`${p.name} ${g}`);
  for (const [f, mine] of Object.entries(topics)) {
    if (!mine.length) continue;
    const theirs = hits(text, FAMILIES[f]);
    if (theirs.length && !theirs.some((x) => mine.includes(x))) return false;
  }
  return true;
}
