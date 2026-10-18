import { describe, expect, it } from "vitest";
import { Tracer } from "./trace";
import type { AgentStep } from "../types";
import { upsertStep } from "../match/client";

describe("Tracer", () => {
  it("records start/done with timing and forwards every update", () => {
    let now = 1000;
    const seen: AgentStep[] = [];
    const tr = new Tracer((s) => seen.push(s), () => now);
    tr.start("search", "Qloo /search", { calls: 2 });
    now = 1450;
    tr.done("search", { found: 3 });
    expect(tr.steps).toEqual([{ id: "search", status: "done", tool: "Qloo /search", ms: 450, data: { calls: 2, found: 3 } }]);
    expect(seen.map((s) => s.status)).toEqual(["running", "done"]);
  });
  it("keeps pipeline order and never lets a broken listener break the run", () => {
    const tr = new Tracer(() => {
      throw new Error("stream closed");
    });
    tr.start("parse");
    tr.done("parse");
    tr.skip("rescue");
    expect(tr.steps.map((s) => s.id)).toEqual(["parse", "rescue"]);
  });
  it("upsertStep updates a step in place on the client", () => {
    const a = upsertStep([], { id: "parse", status: "running" });
    const b = upsertStep(a, { id: "search", status: "running" });
    const c = upsertStep(b, { id: "parse", status: "done", ms: 5 });
    expect(c.map((s) => `${s.id}:${s.status}`)).toEqual(["parse:done", "search:running"]);
  });
});
