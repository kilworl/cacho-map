"use client";
import CountUp from "./reactbits/CountUp";
import ShinyText from "./reactbits/ShinyText";
import TiltedCard from "./reactbits/TiltedCard";
import { ZoneList } from "./ZoneList";
import { ShareActions } from "./ShareActions";
import type { MatchResult, ZoneStat } from "@/lib/types";
import { shareQuery } from "@/lib/share";
import { useI18n } from "@/lib/i18n/LangProvider";
import { WHO_COLOR } from "./map/mapTheme";
import { breakdown, calc, list, pctChain, tasteName } from "@/lib/explain";
import { isPlaceKind, placeKindLabel } from "@/lib/places/catalog";

interface Props {
  r: MatchResult;
  onZone: (z: ZoneStat) => void;
  onReset: () => void;
}

export function ResultView({ r, onZone, onReset }: Props) {
  const { t, lang } = useI18n();
  const q = shareQuery(r);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/r?${q}` : "";
  const [label, ...rest] = r.roast.title.split(" · ");
  return (
    <article className="result">
      <header className="result-head">
        <p className="couple">
          <span style={{ color: WHO_COLOR.a }}>{r.a}</span> <i>×</i> <span style={{ color: WHO_COLOR.b }}>{r.b}</span>
          <small> · {r.city.name}</small>
        </p>
        <div className={`risk risk--${r.level}`}>
          <div className="big-pct" aria-label={`${t.cachos}: ${r.risk}%`}>
            <span className="big-label">{t.cachos}:</span>
            <CountUp to={r.risk} duration={1.6} trigger="load" className="big-num" />
            <span className="big-sign">%</span>
          </div>
          <div className="risk-bar" aria-hidden="true">
            <span style={{ width: `${Math.max(4, r.risk)}%` }} />
            <i style={{ left: "35%" }} /><i style={{ left: "60%" }} /><i style={{ left: "80%" }} />
          </div>
          <span className="risk-level">{t.levels[r.level]}</span>
        </div>
        <p className="pct-explain">{pctChain(r, lang)}</p>
        <details className="how-calc">
          <summary>{t.howCalcTitle}</summary>
          <ul>{t.howCalc(calc(r, lang)).map((line) => <li key={line}>{line}</li>)}</ul>
          {breakdown(r, lang).map((b) => (
            <div key={b.title} className="breakdown">
              <p>{b.title}</p>
              <ul>{b.lines.map((l) => <li key={l}>{l}</li>)}</ul>
            </div>
          ))}
        </details>
        <h2 className="result-title">
          <ShinyText text={rest.join(" · ") || label} color="#1a1410" shineColor="#ff3b1f" speed={3} />
        </h2>
      </header>

      <blockquote className="roast">{r.roast.roast}</blockquote>

      <div className="stats">
        <span><b>{r.shared}</b> {t.placesStat}</span>
        <span><b>{r.tagScore}%</b> {t.tagsStat}</span>
        <a className="see-map" href="#map">{t.seeMap}</a>
      </div>

      <div className="plan">
        <span className="sticker">{t.planTitle}</span>
        <p>{r.roast.plan}</p>
      </div>

      <Understood r={r} />

      <ZoneList r={r} onPick={onZone} />

      <div className="legend" aria-hidden="true">
        <span><i style={{ background: WHO_COLOR.both }} />{t.legendBoth}</span>
        <span><i style={{ background: WHO_COLOR.a }} />{t.legendOnly(r.a)}</span>
        <span><i style={{ background: WHO_COLOR.b }} />{t.legendOnly(r.b)}</span>
      </div>

      <div className="card-wrap">
        <TiltedCard
          imageSrc={`/api/card?${q}`}
          altText={r.roast.title}
          containerHeight="420px"
          containerWidth="100%"
          imageWidth="320px"
          imageHeight="400px"
          rotateAmplitude={10}
          scaleOnHover={1.03}
          showTooltip={false}
          gyroscope={false}
          glare={0.35}
          radius={18}
        />
      </div>

      <ShareActions url={shareUrl} text={`${r.roast.title} 🦌`} />

      {r.agent === "fallback" && <p className="fine">{t.agentFallback}</p>}
      <button type="button" className="btn btn--ghost" onClick={onReset}>{t.again}</button>
    </article>
  );
}

/** "What Qloo understood": per person, each atomic taste, what Qloo matched it to and which places it looks for; rejected ones crossed out with the reason. */
function Understood({ r }: { r: MatchResult }) {
  const { t, lang } = useI18n();
  const people = [
    { who: r.a, side: "a", found: r.tastesA, missing: r.missingA },
    { who: r.b, side: "b", found: r.tastesB, missing: r.missingB },
  ] as const;
  const reason = (m: MatchResult["missingA"][number]) =>
    m.reason === "low_confidence" && m.got ? t.missingReason.low_confidence(m.got) : m.reason === "no_places" ? t.missingReason.no_places : t.missingReason.no_match;
  return (
    <section className="understood">
      <h3>{t.qlooSaw}</h3>
      {people.map((p) => (
        <div key={p.side} className={`understood-row understood--${p.side}`}>
          <span className="understood-who">{p.who}</span>
          <div className="chips">
            {p.found.map((e, i) => {
              const label = tasteName(e, lang);
              const kinds = e.placeMode === "typed" ? (e.places ?? []).filter(isPlaceKind).map((k) => placeKindLabel(k, lang)) : [];
              const qloo = e.type !== "place_kind" && e.name.toLowerCase() !== label.toLowerCase() ? e.name : "";
              return (
                <span key={i} className="chip chip--ok" title={e.input}>
                  {label}
                  <small>{t.entityTypes[e.type] ?? e.type.replace("_", " ")}</small>
                  {qloo && <em>= {qloo}</em>}
                  {kinds.length > 0 && <em>→ {list(kinds.slice(0, 2), lang)}</em>}
                  {e.pair != null && <em className="chip-pair">↔ {t.sharedTaste}</em>}
                </span>
              );
            })}
            {p.missing.map((m) => (
              <span key={m.input} className="chip chip--miss" title={reason(m)}>
                <s>{m.label ? (lang === "es" ? m.label.es : m.label.en) : m.input}</s>
                <em>{reason(m)}</em>
              </span>
            ))}
          </div>
        </div>
      ))}
      {(r.missingA.length > 0 || r.missingB.length > 0) && <p className="fine">{t.missingNote}</p>}
    </section>
  );
}
