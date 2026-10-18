"use client";
import { useState } from "react";
import TiltedCard from "./reactbits/TiltedCard";
import { ShareActions } from "./ShareActions";
import type { CardFormat } from "@/lib/card/params";
import { useI18n } from "@/lib/i18n/LangProvider";

const SIZES: Record<CardFormat, [number, number]> = { story: [225, 400], post: [320, 400], og: [340, 179] };

/** Share card in 3 formats (story / post / X), with native image share, download and link share. */
export function ShareCard({ query, url, text, alt }: { query: string; url: string; text: string; alt: string }) {
  const { t } = useI18n();
  const [f, setF] = useState<CardFormat>("story");
  const src = `/api/card?f=${f}&${query}`;
  const [w, h] = SIZES[f];
  const shareImage = async () => {
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], `cacho-map-${f}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text} ${url}` });
        return;
      }
    } catch {
      /* cancelled or unsupported: fall back to download */
    }
    const a = document.createElement("a");
    a.href = `${src}&dl=1`;
    a.download = `cacho-map-${f}.png`;
    a.click();
  };
  return (
    <section className="sharecard">
      <h3>{t.shareCardTitle}</h3>
      <div className="formats" role="tablist">
        {(["story", "post", "og"] as const).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={f === x} className={f === x ? "on" : ""} onClick={() => setF(x)}>{t.formats[x]}</button>
        ))}
      </div>
      <div className="card-wrap" style={{ height: h + 30 }}>
        <TiltedCard key={f} imageSrc={src} altText={alt} containerHeight={`${h + 20}px`} containerWidth="100%" imageWidth={`${w}px`} imageHeight={`${h}px`} rotateAmplitude={10} scaleOnHover={1.03} showTooltip={false} gyroscope={false} glare={0.35} radius={18} />
      </div>
      <div className="share share--img">
        <button type="button" className="btn btn--img" onClick={() => void shareImage()}>{t.shareImage}</button>
        <a className="btn btn--ghost" href={`${src}&dl=1`} download>{t.download}</a>
      </div>
      <ShareActions url={url} text={text} />
    </section>
  );
}
