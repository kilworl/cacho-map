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

interface Props {
  r: MatchResult;
  onZone: (z: ZoneStat) => void;
  onReset: () => void;
}

export function ResultView({ r, onZone, onReset }: Props) {
  const { t } = useI18n();
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
        <div className="big-pct" aria-label={`${r.cachos}% ${t.cachos}`}>
          <CountUp to={r.cachos} duration={1.6} trigger="load" className="big-num" />
          <span className="big-sign">%</span>
          <span className="big-label">{t.cachos}</span>
        </div>
        <p className="pct-explain">{t.pctExplain(r.cachos)}</p>
        <details className="how-calc">
          <summary>{t.howCalcTitle}</summary>
          <ul>{t.howCalc(r.tagScore, r.placeScore, r.compat).map((line) => <li key={line}>{line}</li>)}</ul>
        </details>
        <h2 className="result-title">
          <ShinyText text={rest.join(" · ") || label} color="#1a1410" shineColor="#ff3b1f" speed={3} />
        </h2>
      </header>

      <blockquote className="roast">{r.roast.roast}</blockquote>

      <div className="stats">
        <span><b>{r.compat}%</b> {t.compat}</span>
        <span><b>{r.tagScore}%</b> {t.tagsStat}</span>
        <span><b>{r.shared}</b> {t.placesStat}</span>
        <a className="see-map" href="#map">{t.seeMap}</a>
      </div>

      <div className="plan">
        <span className="sticker">{t.planTitle}</span>
        <p>{r.roast.plan}</p>
      </div>

      <Understood r={r} />

      <ZoneList zones={r.zones} a={r.a} b={r.b} onPick={onZone} />

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

/** "What Qloo understood": per person, what each typed taste resolved to, and what it couldn't match. */
function Understood({ r }: { r: MatchResult }) {
  const { t } = useI18n();
  const people = [
    { who: r.a, side: "a", found: r.tastesA, missing: r.missingA },
    { who: r.b, side: "b", found: r.tastesB, missing: r.missingB },
  ] as const;
  return (
    <section className="understood">
      <h3>{t.qlooSaw}</h3>
      {people.map((p) => (
        <div key={p.side} className={`understood-row understood--${p.side}`}>
          <span className="understood-who">{p.who}</span>
          <div className="chips">
            {p.found.map((e) => (
              <span key={e.id} className="chip chip--ok" title={e.input}>
                {e.name}
                <small>{e.type === "tag" ? t.category : e.type.replace("_", " ")}</small>
                {e.input.toLowerCase() !== e.name.toLowerCase() && <em>← {e.input}</em>}
              </span>
            ))}
            {p.missing.map((m) => (
              <span key={m} className="chip chip--miss" title={t.missingHint}>✕ {m}</span>
            ))}
          </div>
        </div>
      ))}
      {(r.missingA.length > 0 || r.missingB.length > 0) && <p className="fine">{t.missing}: {t.missingHint}</p>}
    </section>
  );
}
