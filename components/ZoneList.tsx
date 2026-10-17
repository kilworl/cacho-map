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
 * Ranked neighborhoods with a plain-language reason: a place in that zone that
 * Qloo recommends for one person but not the other. The bar shows that zone's
 * disagreement (no number, to avoid confusing it with the overall %).
 */
export function ZoneList({ zones, a, b, onPick }: Props) {
  const { t } = useI18n();
  return (
    <section className="zones">
      <h3>{t.zonesTitle}</h3>
      <p className="zones-sub">{t.zonesSub}</p>
      <ol>
        {zones.filter((z) => z.clashPct > 0).slice(0, 5).map((z, i) => {
          const ex = z.onlyA ? { p: z.onlyA, who: a, not: b } : z.onlyB ? { p: z.onlyB, who: b, not: a } : null;
          const ex2 = z.onlyA && z.onlyB ? { p: z.onlyB, who: b } : null;
          return (
            <li key={z.zone} style={{ ["--i" as string]: i }}>
              <button type="button" onClick={() => onPick(z)}>
                <span className="zone-name">{z.zone}</span>
                <span className="zone-meta">{t.zoneLine(z.n, z.both)}</span>
                <span className="zone-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(6, z.clashPct)}%`, background: z.clashPct > 66 ? "var(--red)" : z.clashPct > 33 ? "var(--yellow)" : "var(--green)" }} />
                </span>
                {i < 3 && ex && (
                  <span className="zone-why">
                    {t.zoneReason(ex.p.name, ex.p.genre, ex.who)}
                    {ex2 ? `; ${t.zoneReason(ex2.p.name, ex2.p.genre, ex2.who)}.` : t.zoneNot(ex.not)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
