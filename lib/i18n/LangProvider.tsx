"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Lang } from "../types";
import { dictionaries, type Dict } from "./dict";

const KEY = "cacho-map:lang";
const Ctx = createContext<{ lang: Lang; t: Dict; setLang: (l: Lang) => void } | null>(null);

/** Language state: stored choice > browser language > Spanish. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");
  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    const initial: Lang = saved === "es" || saved === "en" ? saved : navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only state after hydration
    setLangState(initial);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(KEY, l);
    setLangState(l);
  }, []);
  return <Ctx.Provider value={{ lang, t: dictionaries[lang], setLang }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside <LangProvider>");
  return v;
}
