"use client";
import type { ZoneStat } from "@/lib/types";
import { useI18n } from "@/lib/i18n/LangProvider";

/** Ranked neighborhoods; the bar shows that zone's disagreement (no numbers, to avoid confusing it with the overall %). */
export function ZoneList({ zones, onPick }: { zones: ZoneStat[]; onPick: (z: ZoneStat) => void }) {
  const { t } = useI18n();
  return (
    <section className="zones">
      <h3>{t.zonesTitle}</h3>
      <ol>
        {zones.slice(0, 5).map((z, i) => (
          <li key={z.zone} style={{ ["--i" as string]: i }}>
            <button type="button" onClick={() => onPick(z)}>
              <span className="zone-name">{z.zone}</span>
              <span className="zone-meta">{t.zoneLine(z.n, z.both)}</span>
              <span className="zone-bar" aria-hidden="true">
                <span style={{ width: `${Math.max(6, z.clashPct)}%`, background: z.clashPct > 66 ? "var(--red)" : z.clashPct > 33 ? "var(--yellow)" : "var(--green)" }} />
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
