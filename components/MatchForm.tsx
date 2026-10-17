"use client";
import ClickSpark from "./reactbits/ClickSpark";
import { useI18n } from "@/lib/i18n/LangProvider";

import type { Pronoun } from "@/lib/types";

export interface FormValues {
  an: string;
  at: string;
  ap: Pronoun;
  bn: string;
  bt: string;
  bp: Pronoun;
  consent: boolean;
}

export const EMPTY_FORM: FormValues = { an: "", at: "", ap: "n", bn: "", bt: "", bp: "n", consent: false };
/** The demo couple, written the way people talk. */
const example = (at: string, bt: string): FormValues => ({ an: "Jesús", at, ap: "m", bn: "Karol", bt, bp: "f", consent: true });
const PRONOUNS: Pronoun[] = ["n", "f", "m"];

/** Appends a suggestion to a comma-separated list, skipping duplicates. */
const addTaste = (list: string, item: string) => {
  const parts = list.split(",").map((x) => x.trim()).filter(Boolean);
  return parts.some((p) => p.toLowerCase() === item.toLowerCase()) ? list : [...parts, item].join(", ");
};

interface Props {
  values: FormValues;
  onChange: (v: FormValues) => void;
  onSubmit: () => void;
  busy: boolean;
}

export function MatchForm({ values: f, onChange, onSubmit, busy }: Props) {
  const { t } = useI18n();
  const set = (k: keyof FormValues, v: string | boolean | Pronoun) => onChange({ ...f, [k]: v });
  const players = [
    { side: "a", label: t.personA, nick: "an", tastes: "at", pron: "ap", nickPh: t.nickA, tastesPh: t.tastesA, ideas: t.suggestionsA },
    { side: "b", label: t.personB, nick: "bn", tastes: "bt", pron: "bp", nickPh: t.nickB, tastesPh: t.tastesB, ideas: t.suggestionsB },
  ] as const;
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <p className="hint">
        {t.tastesHint}{" "}
        <button type="button" className="linkish" onClick={() => onChange(example(t.exampleA, t.exampleB))}>{t.example}</button>
      </p>

      <div className="players">
        {players.map((p, i) => (
          <fieldset key={p.side} className={`player player--${p.side}`}>
            <legend>{p.label}</legend>
            <div className="nick-row">
              <input required maxLength={24} placeholder={p.nickPh} value={f[p.nick]} onChange={(e) => set(p.nick, e.target.value)} aria-label={p.nickPh} />
              <div className="pronoun" role="radiogroup" aria-label={t.pronounLabel}>
                {PRONOUNS.map((pr) => (
                  <button key={pr} type="button" role="radio" aria-checked={f[p.pron] === pr} className={f[p.pron] === pr ? "on" : ""} onClick={() => set(p.pron, pr)}>
                    {t.pronouns[pr]}
                  </button>
                ))}
              </div>
            </div>
            <textarea required rows={3} maxLength={500} placeholder={p.tastesPh} value={f[p.tastes]} onChange={(e) => set(p.tastes, e.target.value)} aria-label={`${p.label}: ${t.tastesHint}`} />
            <div className="chips" aria-label={t.suggest}>
              <span>{t.suggest}</span>
              {p.ideas.map((idea) => (
                <button key={idea} type="button" className="chip" onClick={() => set(p.tastes, addTaste(f[p.tastes], idea))}>+ {idea}</button>
              ))}
            </div>
            {i === 0 && <span className="vs" aria-hidden="true">{t.vs}</span>}
          </fieldset>
        ))}
      </div>
      <label className="consent">
        <input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} required />
        <span>{t.consent}</span>
      </label>
      <ClickSpark sparkColor={["#ff3b1f", "#ffc21a", "#2563ff"]} sparkCount={10} sparkRadius={28} shape="star">
        <button className="cta" disabled={busy}>
          {t.submit} <span aria-hidden="true">→</span>
        </button>
      </ClickSpark>
    </form>
  );
}
