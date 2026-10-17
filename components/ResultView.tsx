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

      <ZoneList zones={r.zones} onPick={onZone} />

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

      <p className="fine">
        {t.qlooSaw}: {r.tastesA.map((e) => e.name).join(", ")} <i>vs</i> {r.tastesB.map((e) => e.name).join(", ")}
        {r.missing.length > 0 && <> · {t.missing}: {r.missing.join(", ")}</>}
        {r.agent === "fallback" && <> · {t.agentFallback}</>}
      </p>
      <button type="button" className="btn btn--ghost" onClick={onReset}>{t.again}</button>
    </article>
  );
}
