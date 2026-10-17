"use client";
import ClickSpark from "./reactbits/ClickSpark";
import { useI18n } from "@/lib/i18n/LangProvider";

export interface FormValues {
  an: string;
  at: string;
  bn: string;
  bt: string;
  consent: boolean;
}

export const EMPTY_FORM: FormValues = { an: "", at: "", bn: "", bt: "", consent: false };
const EXAMPLE: FormValues = { an: "Caro", at: "Mentalista, videojuegos, superhéroes, Rápido y furioso", bn: "Dani", bt: "Taylor Swift, Gilmore Girls, Harry Potter, comida mexicana", consent: true };

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
  const set = (k: keyof FormValues, v: string | boolean) => onChange({ ...f, [k]: v });
  const players = [
    { side: "a", label: t.personA, nick: "an", tastes: "at", nickPh: t.nickA, tastesPh: t.tastesA, ideas: t.suggestionsA },
    { side: "b", label: t.personB, nick: "bn", tastes: "bt", nickPh: t.nickB, tastesPh: t.tastesB, ideas: t.suggestionsB },
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
        <button type="button" className="linkish" onClick={() => onChange(EXAMPLE)}>{t.example}</button>
      </p>

      <div className="players">
        {players.map((p, i) => (
          <fieldset key={p.side} className={`player player--${p.side}`}>
            <legend>{p.label}</legend>
            <input required maxLength={24} placeholder={p.nickPh} value={f[p.nick]} onChange={(e) => set(p.nick, e.target.value)} aria-label={p.nickPh} />
            <textarea required rows={3} maxLength={400} placeholder={p.tastesPh} value={f[p.tastes]} onChange={(e) => set(p.tastes, e.target.value)} aria-label={`${p.label}: ${t.tastesHint}`} />
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
