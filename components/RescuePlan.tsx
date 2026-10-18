"use client";
import { motion } from "motion/react";
import type { GeoPoint, MatchResult, RescueStop } from "@/lib/types";
import { useI18n } from "@/lib/i18n/LangProvider";
import { list, tasteName } from "@/lib/explain";
import { placeType } from "@/lib/i18n/placeTypes";
import { WHO_COLOR } from "./map/mapTheme";

interface Props {
  r: MatchResult;
  onFocus: (p: GeoPoint) => void;
}

/** "Plan de rescate": 2-3 real stops near the couple, each saying which taste of each person it satisfies. */
export function RescuePlan({ r, onFocus }: Props) {
  const { t, lang } = useI18n();
  const plan = r.rescue;
  if (!plan?.stops.length) {
    return (
      <div className="plan">
        <span className="sticker">{t.planTitle}</span>
        <p>{r.roast.plan}</p>
      </div>
    );
  }
  const names = (idx: number[], side: "a" | "b") => list(idx.map((i) => tasteName((side === "a" ? r.tastesA : r.tastesB)[i], lang, true)).filter(Boolean), lang);
  const why = (s: RescueStop) => {
    const ta = names(s.forA, "a");
    const tb = names(s.forB, "b");
    if (ta && tb) return t.rescueWhyBoth(r.a, ta, r.b, tb);
    return ta ? t.rescueWhyOne(r.a, ta, r.b) : t.rescueWhyOne(r.b, tb, r.a);
  };
  const alternating = plan.stops.some((s) => !s.forA.length || !s.forB.length);
  return (
    <section className="rescue">
      <span className="sticker sticker--rescue">{t.rescueTitle}</span>
      <h3>{plan.title || t.rescueDefault(r.a, r.b)}</h3>
      <p className="fine">{alternating ? t.rescueAlternate : t.rescueSub}</p>
      <ol className="rescue-stops">
        {plan.stops.map((s, i) => {
          const type = placeType(s.genre, lang);
          return (
            <motion.li key={s.id} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}>
              <span className="rescue-num" aria-hidden="true">{i + 1}</span>
              <div>
                <p className="rescue-name">
                  <b>{s.name}</b>
                  <small>{[type && (type.known || lang === "en") ? type.plural : undefined, s.zone].filter(Boolean).join(" · ")}</small>
                </p>
                {s.line && <p className="rescue-line">{s.line}</p>}
                <p className="rescue-why">{why(s)}</p>
                <div className="chips">
                  {s.forA.length > 0 && <span className="chip chip--for" style={{ borderColor: WHO_COLOR.a }}>{t.rescueFor(r.a, names(s.forA, "a"))}</span>}
                  {s.forB.length > 0 && <span className="chip chip--for" style={{ borderColor: WHO_COLOR.b }}>{t.rescueFor(r.b, names(s.forB, "b"))}</span>}
                  <span className="chip chip--km">{i === 0 ? t.rescueKmFirst(s.km) : t.rescueKm(s.km)}</span>
                  <button type="button" className="linkish" onClick={() => onFocus(s)}>{t.rescueSeeMap}</button>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
