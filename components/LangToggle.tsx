"use client";
import { useI18n } from "@/lib/i18n/LangProvider";

import type { Lang } from "@/lib/types";

/** `onSwitch` lets the page regenerate language-specific AI copy after a switch. */
export function LangToggle({ onSwitch }: { onSwitch?: (l: Lang) => void }) {
  const { lang, setLang } = useI18n();
  return (
    <div className="lang" role="group" aria-label="Language / Idioma">
      {(["es", "en"] as const).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} className={lang === l ? "on" : ""} onClick={() => { if (l !== lang) { setLang(l); onSwitch?.(l); } }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
