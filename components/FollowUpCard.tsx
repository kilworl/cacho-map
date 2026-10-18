"use client";
import { useState } from "react";
import { motion } from "motion/react";
import type { FollowUp } from "@/lib/types";
import { useI18n } from "@/lib/i18n/LangProvider";
import { list } from "@/lib/explain";

interface Props {
  q: FollowUp;
  /** The answer to append to that person's tastes ("" = go on without adding). */
  onAnswer: (extra: string) => void;
}

/** The agent's follow-up question when one person's input is too thin, with one-tap answers. */
export function FollowUpCard({ q, onAnswer }: Props) {
  const { t, lang } = useI18n();
  const [text, setText] = useState("");
  const have = q.have.map((h) => h[lang]);
  const bare = (x: string) => x.toLowerCase().replace(/^(el|la|los|las|the)\s+/, "").trim();
  const taken = new Set([...q.fromOther.map((x) => bare(x[lang])), ...have.map(bare)]);
  const ideas = t.followUpIdeas[q.reason].filter((x) => !taken.has(bare(x)));
  const add = (x: string) => setText((cur) => (cur.split(",").map((s) => s.trim().toLowerCase()).includes(x.toLowerCase()) ? cur : cur.trim() ? `${cur.trim()}, ${x}` : x));
  return (
    <motion.section className="followup" initial={{ opacity: 0, y: 18, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} role="dialog" aria-labelledby="followup-q">
      <span className="sticker sticker--ask">{t.followUpTitle}</span>
      <p id="followup-q" className="followup-q">{t.followUpQ[q.reason](q.nick)}</p>
      <p className="fine">{have.length ? t.followUpHave(list(have, lang)) : t.followUpNothing}</p>
      <form onSubmit={(e) => { e.preventDefault(); onAnswer(text.trim()); }}>
        <input autoFocus value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder={t.followUpPh} aria-label={t.followUpQ[q.reason](q.nick)} />
        <div className="chips">
          {q.fromOther.length > 0 && <span>{t.followUpOther}</span>}
          {q.fromOther.map((x) => <button key={x.en} type="button" className="chip chip--other" onClick={() => add(x[lang])}>+ {x[lang]}</button>)}
          {ideas.map((x) => <button key={x} type="button" className="chip" onClick={() => add(x)}>+ {x}</button>)}
        </div>
        <div className="followup-actions">
          <button className="cta" disabled={!text.trim()}>{t.followUpAdd} <span aria-hidden="true">→</span></button>
          <button type="button" className="btn btn--ghost" onClick={() => onAnswer("")}>{t.followUpSkip}</button>
        </div>
      </form>
    </motion.section>
  );
}
