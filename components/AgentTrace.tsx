"use client";
import { AnimatePresence, motion } from "motion/react";
import type { AgentStep, Lang } from "@/lib/types";
import { useI18n } from "@/lib/i18n/LangProvider";
import { dictionaries } from "@/lib/i18n/dict";
import { list } from "@/lib/explain";

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

/** One line of facts per step, in the UI language, built from the step's plain data. */
export function stepDetail(s: AgentStep, lang: Lang, nicks: { a: string; b: string }): string {
  const t = dictionaries[lang];
  const d = s.data ?? {};
  const short = (xs: string[], n = 4) => list(xs.slice(0, n), lang) + (xs.length > n ? "…" : "");
  switch (s.id) {
    case "parse":
      return d.a ? `${nicks.a}: ${short(arr(d.a))} · ${nicks.b}: ${short(arr(d.b))}` : "";
    case "clarify":
      return s.status !== "done" ? "" : num(d.ok) ? t.clarifyOk : t.clarifyAsk(String(d.who ?? ""));
    case "search":
      return d.a ? `${nicks.a}: ${short(arr(d.a), 3)} · ${nicks.b}: ${short(arr(d.b), 3)} · ${t.searchMissing(num(d.missing))}` : "";
    case "places":
      return s.status === "done" ? t.placesDetail(num(d.calls), nicks.a, num(d.a), nicks.b, num(d.b)) : "";
    case "compare":
      return s.status === "done" ? t.compareDetail(num(d.tags), list(arr(d.top), lang)) : "";
    case "score":
      return t.scoreDetail(num(d.risk), num(d.taste), num(d.plans));
    case "zones":
      return t.zonesDetail(list(arr(d.danger), lang), list(arr(d.safe), lang));
    case "roast":
      return s.status === "done" ? t.roastDetail(arr(d.tools).join(", "), num(d.judged), num(d.dropped)) : "";
    case "rescue":
      return s.status === "done" ? t.rescueDetail(list(arr(d.stops), lang)) : "";
  }
}

interface Props {
  steps: AgentStep[];
  nicks: { a: string; b: string };
  /** Live = shown while the agent works (open, animated); otherwise a collapsible replay. */
  live?: boolean;
}

/** The agent's reasoning, step by step: what it did, which Qloo tool it used, and what it found. */
export function AgentTrace({ steps, nicks, live }: Props) {
  const { t, lang } = useI18n();
  const body = (
    <ol className="trace-list">
      <AnimatePresence initial={false}>
        {steps.map((s) => {
          const info = t.steps[s.id];
          const detail = stepDetail(s, lang, nicks);
          return (
            <motion.li
              key={s.id}
              layout
              initial={{ opacity: 0, x: -14, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className={`trace-step trace-step--${s.status}`}
            >
              <span className="trace-dot" aria-hidden="true">{s.status === "done" ? "✓" : s.status === "skipped" ? "–" : ""}</span>
              <div className="trace-body">
                <p className="trace-head">
                  <b>{info.title}</b>
                  {s.tool && <code className="trace-tool">{s.tool}</code>}
                  {s.status === "running" && <em className="trace-run">{t.traceRunning}</em>}
                  {s.ms != null && s.status === "done" && <small>{(s.ms / 1000).toFixed(1)} s</small>}
                </p>
                <p className="trace-why">{info.why}</p>
                {detail && <p className="trace-detail">{detail}</p>}
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
  if (live) {
    return (
      <section className="trace trace--live" aria-live="polite">
        <h3><span className="trace-pulse" aria-hidden="true" />{t.traceLive}</h3>
        {body}
      </section>
    );
  }
  return (
    <details className="trace">
      <summary>{t.traceTitle} <small>({steps.length})</small></summary>
      {body}
    </details>
  );
}
