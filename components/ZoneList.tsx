"use client";
import type { ZoneStat } from "@/lib/types";
import { useI18n } from "@/lib/i18n/LangProvider";

interface Props {
  zones: ZoneStat[];
  a: string;
  b: string;
  onPick: (z: ZoneStat) => void;
}

/**
 * Danger zones (places only one of them likes: one would go alone) and safe zones
 * (places both like). Each card has a characterization built from Qloo place data.
 */
export function ZoneList({ zones, onPick }: Props) {
  const { t } = useI18n();
  const danger = zones.filter((z) => z.kind === "danger").slice(0, 3);
  const safe = zones.filter((z) => z.kind === "safe").slice(0, 2);
  return (
    <section className="zones">
      <h3>{t.zonesTitle}</h3>
      <p className="zones-sub">{t.zonesSub}</p>
      <ol>
        {[...danger, ...safe].map((z, i) => (
          <li key={z.zone} style={{ ["--i" as string]: i }} className={`zone zone--${z.kind}`}>
            <button type="button" onClick={() => onPick(z)}>
              <span className="zone-top">
                <span className="zone-name">{z.zone}</span>
                <span className={`zone-badge zone-badge--${z.kind}`}>{z.kind === "danger" ? t.danger : t.safe}</span>
              </span>
              <span className="zone-meta">{t.zoneLine(z.n, z.both)}</span>
              {z.description && <span className="zone-desc">{z.description}</span>}
              {z.why && <span className="zone-why">{z.why}</span>}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
