import type { AgentStep } from "../types";
import type { MatchEvent } from "./run";

export type FinalEvent = Exclude<MatchEvent, { type: "step" }> | { type: "error"; error: "consent" | "invalid" | "network" | "busy" };

/**
 * Browser side of POST /api/match?stream=1: reads the NDJSON stream, reports each agent
 * step as it arrives and resolves with the final event (result, question or error).
 */
export async function streamMatch(body: unknown, onStep: (s: AgentStep) => void, signal?: AbortSignal): Promise<FinalEvent> {
  let res: Response;
  try {
    res = await fetch("/api/match?stream=1", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  } catch {
    return { type: "error", error: "network" };
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    return { type: "error", error: data.error === "consent" || data.error === "invalid" ? data.error : "busy" };
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  let final: FinalEvent | null = null;
  const handle = (line: string) => {
    if (!line.trim()) return;
    const ev = JSON.parse(line) as MatchEvent;
    if (ev.type === "step") onStep(ev.step);
    else final = ev;
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      lines.forEach(handle);
    }
    handle(buf);
  } catch {
    return { type: "error", error: "network" };
  }
  return final ?? { type: "error", error: "busy" };
}

/** Merges a step update into the list (same id = update in place). */
export function upsertStep(steps: AgentStep[], s: AgentStep): AgentStep[] {
  const i = steps.findIndex((x) => x.id === s.id);
  if (i < 0) return [...steps, s];
  const next = [...steps];
  next[i] = s;
  return next;
}
