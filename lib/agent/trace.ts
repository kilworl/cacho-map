import type { AgentStep, StepId } from "../types";

export type StepListener = (step: AgentStep) => void;

/**
 * Records the agent's steps (what it did, with which tool, and the facts it found) and
 * forwards each update to a listener, e.g. the NDJSON stream of POST /api/match.
 * The final list is returned with the result so a shared/live result can replay it.
 */
export class Tracer {
  readonly steps: AgentStep[] = [];
  private started = new Map<StepId, number>();

  constructor(private listener?: StepListener, private now: () => number = Date.now) {}

  start(id: StepId, tool?: string, data?: AgentStep["data"]): void {
    this.started.set(id, this.now());
    this.put({ id, status: "running", ...(tool && { tool }), ...(data && { data }) });
  }

  done(id: StepId, data?: AgentStep["data"]): void {
    const t = this.started.get(id);
    const prev = this.steps.find((s) => s.id === id);
    this.put({ ...prev, id, status: "done", ...(t != null && { ms: this.now() - t }), ...(data && { data: { ...prev?.data, ...data } }) });
  }

  skip(id: StepId, data?: AgentStep["data"]): void {
    this.put({ id, status: "skipped", ...(data && { data }) });
  }

  private put(step: AgentStep): void {
    const i = this.steps.findIndex((s) => s.id === step.id);
    if (i < 0) this.steps.push(step);
    else this.steps[i] = step;
    try {
      this.listener?.(step);
    } catch {
      /* a closed stream must never break the pipeline */
    }
  }
}
