"use client";
import { useMemo } from "react";
import type { Lang, MatchResult } from "@/lib/types";
import { placeWhy } from "@/lib/explain";
import { placeType } from "@/lib/i18n/placeTypes";

/** Map pins with their "why" and type label in the UI language. */
export function useResultPins(result: MatchResult | null, lang: Lang) {
  return useMemo(
    () =>
      (result?.pins ?? []).map((p) => {
        const type = placeType(p.tags?.genres?.[0] ?? p.genre, lang);
        return { ...p, why: placeWhy(p, result!, lang), typeLabel: type && (type.known || lang === "en") ? type.plural : undefined };
      }),
    [result, lang],
  );
}
