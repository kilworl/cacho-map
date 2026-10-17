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
const EXAMPLE: FormValues = { an: "La Mona", at: "Bad Bunny, Karol G, Fast & Furious", bn: "El Flaco", bt: "Radiohead, Amélie, Gabriel García Márquez", consent: true };

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
    { side: "a", label: t.personA, nick: "an", tastes: "at", nickPh: t.nickA, tastesPh: t.tastesA },
    { side: "b", label: t.personB, nick: "bn", tastes: "bt", nickPh: t.nickB, tastesPh: t.tastesB },
  ] as const;
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="players">
        {players.map((p, i) => (
          <fieldset key={p.side} className={`player player--${p.side}`}>
            <legend>{p.label}</legend>
            <input required maxLength={24} placeholder={p.nickPh} value={f[p.nick]} onChange={(e) => set(p.nick, e.target.value)} aria-label={p.nickPh} />
            <textarea required rows={3} maxLength={400} placeholder={p.tastesPh} value={f[p.tastes]} onChange={(e) => set(p.tastes, e.target.value)} aria-label={t.tastesHint} />
            {i === 0 && <span className="vs" aria-hidden="true">{t.vs}</span>}
          </fieldset>
        ))}
      </div>
      <p className="hint">
        {t.tastesHint}{" "}
        <button type="button" className="linkish" onClick={() => onChange(EXAMPLE)}>{t.example}</button>
      </p>
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
