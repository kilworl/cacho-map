/**
 * "Pareja en vivo": one person opens a session and shares a link/QR; each person types
 * their own tastes on their own phone without seeing the other's; when both are in,
 * the match runs once and both phones (polling) reveal the same result.
 *
 * Storage layout (one JSON doc per key, so the two phones never write the same key):
 *   live/{id}/meta.json  city + language
 *   live/{id}/a.json     person A's input (claim-once)
 *   live/{id}/b.json     person B's input (claim-once)
 *   live/{id}/run-es.json  compute marker, live agent trace, then the result (one per language)
 */
import { randomBytes } from "node:crypto";
import type { AgentStep, CityContext, FollowUp, Lang, MatchResult, ParsedTaste, Pronoun } from "../types";
import { KeyExistsError, type JsonStore } from "./store";
import { thinReason } from "../agent/clarify";

export type Side = "a" | "b";

export interface LiveMeta {
  id: string;
  city: CityContext;
  lang: Lang;
  createdAt: number;
}

export interface LiveSideDoc {
  nick: string;
  pronoun: Pronoun;
  tastes: string;
  parsed: ParsedTaste[];
  llm: boolean;
  at: number;
}

export interface LiveRunDoc {
  startedAt: number;
  /** The agent's steps so far, so both phones watch it think. */
  trace?: AgentStep[];
  finishedAt?: number;
  result?: MatchResult;
  error?: string;
}

export interface LiveStatus {
  id: string;
  city: CityContext;
  lang: Lang;
  a: { done: boolean; nick?: string };
  b: { done: boolean; nick?: string };
  state: "waiting" | "computing" | "done" | "error";
  trace?: AgentStep[];
  result?: MatchResult;
  error?: string;
}

/** A compute that started this long ago and never finished is considered dead and retried. */
export const STALE_RUN_MS = 75_000;
const ID = /^[A-Za-z0-9]{10}$/;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export const isSessionId = (id: string) => ID.test(id);
export function newSessionId(bytes: Uint8Array = randomBytes(10)): string {
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}
const k = (id: string, doc: "meta" | Side | `run-${Lang}`) => `live/${id}/${doc}.json`;

export class SessionNotFound extends Error {}
export class SideTaken extends Error {}

export async function createSession(store: JsonStore, city: CityContext, lang: Lang, now = Date.now()): Promise<LiveMeta> {
  const meta: LiveMeta = { id: newSessionId(), city, lang, createdAt: now };
  await store.put(k(meta.id, "meta"), meta, { create: true });
  return meta;
}

export type Parse = (text: string) => Promise<{ tastes: ParsedTaste[]; llm: boolean }>;

/**
 * Saves one person's input. Thin input gets a follow-up question (asked once) instead
 * of being saved. Returns whether both people are now in.
 */
export async function submitSide(
  store: JsonStore,
  id: string,
  side: Side,
  input: { nick: string; pronoun: Pronoun; tastes: string; asked?: boolean },
  parse: Parse,
  now = Date.now(),
): Promise<{ followUp: FollowUp } | { both: boolean }> {
  const meta = await store.get<LiveMeta>(k(id, "meta"));
  if (!meta) throw new SessionNotFound();
  if (await store.get(k(id, side))) throw new SideTaken();
  const { tastes, llm } = await parse(input.tastes);
  const reason = input.asked ? null : thinReason(tastes);
  if (reason) return { followUp: { who: side, nick: input.nick, reason, have: tastes.map((t) => ({ es: t.label.es, en: t.label.en })), fromOther: [] } };
  const doc: LiveSideDoc = { nick: input.nick, pronoun: input.pronoun, tastes: input.tastes, parsed: tastes, llm, at: now };
  try {
    await store.put(k(id, side), doc, { create: true });
  } catch (e) {
    if (e instanceof KeyExistsError) throw new SideTaken();
    throw e;
  }
  const other = await store.get<LiveSideDoc>(k(id, side === "a" ? "b" : "a"));
  return { both: !!other };
}

export async function getStatus(store: JsonStore, id: string, want?: Lang): Promise<LiveStatus & { run: LiveRunDoc | null }> {
  const meta = await store.get<LiveMeta>(k(id, "meta"));
  if (!meta) throw new SessionNotFound();
  const lang = want ?? meta.lang;
  const [a, b, run] = await Promise.all([
    store.get<LiveSideDoc>(k(id, "a")),
    store.get<LiveSideDoc>(k(id, "b")),
    store.get<LiveRunDoc>(k(id, `run-${lang}`)),
  ]);
  // Before the reveal only nicknames leave the server: nobody sees the other's tastes.
  const state: LiveStatus["state"] = run?.result ? "done" : run?.error ? "error" : a && b ? "computing" : "waiting";
  return {
    id, city: meta.city, lang, run,
    a: { done: !!a, nick: a?.nick }, b: { done: !!b, nick: b?.nick },
    state, ...(run?.trace && !run.result && { trace: run.trace }), ...(run?.result && { result: run.result }), ...(run?.error && { error: run.error }),
  };
}

/** Both are in and nothing is running (or the last run died): time to compute. */
export function shouldCompute(s: Pick<LiveStatus, "a" | "b"> & { run: LiveRunDoc | null }, now = Date.now()): boolean {
  if (!s.a.done || !s.b.done) return false;
  if (!s.run) return true;
  if (s.run.result) return false;
  return !s.run.finishedAt && now - s.run.startedAt > STALE_RUN_MS;
}

export type Runner = (input: {
  a: LiveSideDoc;
  b: LiveSideDoc;
  meta: LiveMeta;
  lang: Lang;
  /** Called with the agent's steps so far; they're saved for both phones. */
  progress: (trace: AgentStep[]) => void;
}) => Promise<MatchResult>;

/** Runs the match once for the session and stores the result (or an error code) for both phones. */
export async function computeSession(store: JsonStore, id: string, lang: Lang, run: Runner, now: () => number = Date.now): Promise<void> {
  const [meta, a, b] = await Promise.all([store.get<LiveMeta>(k(id, "meta")), store.get<LiveSideDoc>(k(id, "a")), store.get<LiveSideDoc>(k(id, "b"))]);
  if (!meta || !a || !b) return;
  const key = k(id, `run-${lang}`);
  const startedAt = now();
  await store.put(key, { startedAt } satisfies LiveRunDoc);
  // Trace writes are chained (never out of order) and the final write waits for them.
  let chain: Promise<unknown> = Promise.resolve();
  let done = false;
  const progress = (trace: AgentStep[]) => {
    const snap = trace.map((s) => ({ ...s }));
    chain = chain.then(() => (done ? undefined : store.put(key, { startedAt, trace: snap } satisfies LiveRunDoc))).catch(() => {});
  };
  let final: LiveRunDoc;
  try {
    const result = await run({ a, b, meta, lang, progress });
    final = { startedAt, finishedAt: now(), result };
  } catch (e) {
    final = { startedAt, finishedAt: now(), error: (e as { code?: string }).code ?? "busy" };
  }
  await chain;
  done = true;
  await store.put(key, final);
}

export async function markRun(store: JsonStore, id: string, lang: Lang, now = Date.now()): Promise<void> {
  await store.put(k(id, `run-${lang}`), { startedAt: now } satisfies LiveRunDoc);
}
