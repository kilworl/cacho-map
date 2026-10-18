import { describe, expect, it } from "vitest";
import { MemoryStore } from "./store";
import { computeSession, createSession, getStatus, isSessionId, newSessionId, shouldCompute, SideTaken, STALE_RUN_MS, submitSide, type Parse } from "./session";
import type { MatchResult, ParsedTaste } from "../types";

const city = { name: "Cartagena", lat: 10.42, lon: -75.55 };
const t = (en: string, kind: ParsedTaste["kind"] = "genre"): ParsedTaste => ({ input: en, label: { es: en, en }, kind, query: en, places: ["bar"] });
/** Fake parser: comma split. */
const parse: Parse = async (text) => ({ tastes: text.split(",").map((x) => x.trim()).filter(Boolean).map((x) => t(x)), llm: true });
const fakeResult = { risk: 81, lang: "es" } as MatchResult;

describe("live session (two phones)", () => {
  it("makes unguessable 10-char ids", () => {
    const id = newSessionId();
    expect(isSessionId(id)).toBe(true);
    expect(isSessionId("../../etc")).toBe(false);
  });

  it("flow: create → A submits → B submits → compute once → both see the result", async () => {
    const store = new MemoryStore();
    const { id } = await createSession(store, city, "es");
    expect((await getStatus(store, id)).state).toBe("waiting");

    expect(await submitSide(store, id, "a", { nick: "Jesús", pronoun: "m", tastes: "metal, gym, motos" }, parse)).toEqual({ both: false });
    const mid = await getStatus(store, id);
    expect(mid.a).toEqual({ done: true, nick: "Jesús" });
    // Privacy: nothing but nicknames before the reveal.
    expect(JSON.stringify(mid)).not.toContain("metal");
    expect(shouldCompute(mid)).toBe(false);

    expect(await submitSide(store, id, "b", { nick: "Karol", pronoun: "f", tastes: "reguetón, playa" }, parse)).toEqual({ both: true });
    const ready = await getStatus(store, id);
    expect(shouldCompute(ready)).toBe(true);

    let calls = 0;
    await computeSession(store, id, "es", async ({ a, b, progress }) => {
      calls++;
      expect(a.parsed.map((x) => x.label.en)).toEqual(["metal", "gym", "motos"]);
      expect(b.nick).toBe("Karol");
      progress([{ id: "parse", status: "done" }]);
      return fakeResult;
    });
    const done = await getStatus(store, id);
    expect(calls).toBe(1);
    expect(done.state).toBe("done");
    expect(done.result?.risk).toBe(81);
    expect(shouldCompute(done)).toBe(false);
  });

  it("asks a thin input one follow-up question on that phone, then accepts it", async () => {
    const store = new MemoryStore();
    const { id } = await createSession(store, city, "en");
    const r = await submitSide(store, id, "b", { nick: "Karol", pronoun: "f", tastes: "sushi" }, parse);
    expect("followUp" in r && r.followUp.reason).toBe("few");
    expect((await getStatus(store, id)).b.done).toBe(false);
    expect(await submitSide(store, id, "b", { nick: "Karol", pronoun: "f", tastes: "sushi", asked: true }, parse)).toEqual({ both: false });
  });

  it("a slot can't be overwritten by the other phone", async () => {
    const store = new MemoryStore();
    const { id } = await createSession(store, city, "es");
    await submitSide(store, id, "a", { nick: "A", pronoun: "n", tastes: "x, y" }, parse);
    await expect(submitSide(store, id, "a", { nick: "Intruso", pronoun: "n", tastes: "z, w" }, parse)).rejects.toBeInstanceOf(SideTaken);
  });

  it("stores an error code for both phones when the match fails, and retries a dead run", async () => {
    const store = new MemoryStore();
    const { id } = await createSession(store, city, "es");
    await submitSide(store, id, "a", { nick: "A", pronoun: "n", tastes: "x, y" }, parse);
    await submitSide(store, id, "b", { nick: "B", pronoun: "n", tastes: "z, w" }, parse);
    await computeSession(store, id, "es", async () => {
      throw Object.assign(new Error("x"), { code: "no_tastes" });
    });
    expect((await getStatus(store, id)).error).toBe("no_tastes");
    const stuck = { a: { done: true }, b: { done: true }, run: { startedAt: 0 } };
    expect(shouldCompute(stuck, STALE_RUN_MS - 1)).toBe(false);
    expect(shouldCompute(stuck, STALE_RUN_MS + 1)).toBe(true);
  });

  it("keeps one result per language (switching language re-runs once)", async () => {
    const store = new MemoryStore();
    const { id } = await createSession(store, city, "es");
    await submitSide(store, id, "a", { nick: "A", pronoun: "n", tastes: "x, y" }, parse);
    await submitSide(store, id, "b", { nick: "B", pronoun: "n", tastes: "z, w" }, parse);
    await computeSession(store, id, "es", async () => fakeResult);
    const en = await getStatus(store, id, "en");
    expect(en.state).toBe("computing");
    expect(shouldCompute(en)).toBe(true);
  });
});
