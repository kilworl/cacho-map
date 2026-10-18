"use client";
import { useI18n } from "@/lib/i18n/LangProvider";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="foot">
      {t.footer} <a href="https://www.qloo.com" target="_blank" rel="noreferrer">Qloo</a> · {t.uiBits}{" "}
      <a href="https://reactbits.dev" target="_blank" rel="noreferrer">React Bits</a> ·{" "}
      <a href="https://github.com/kilworl/cacho-map" target="_blank" rel="noreferrer">GitHub</a>
    </footer>
  );
}
