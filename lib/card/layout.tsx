/* Satori (next/og) layout for the share card. Plain JSX + inline styles only: every div needs display flex. */
import type { CardData, CardFormat, CardZone } from "./params";
import { dictionaries } from "../i18n/dict";

export const LEVEL_COLOR = { armored: "#12b76a", low: "#2563ff", medium: "#ffc21a", high: "#ff7a1a", cheating: "#ff3b1f" } as const;
const INK = "#1a1410";
const PAPER = "#f6ecd9";

/** A stylized city map: streets grid, water edge and the couple's zones (red = danger, green = safe). */
/** Keeps pins inside the frame, puts labels on the roomy side and drops labels that would overlap a riskier zone's. */
export function placeLabels(zones: CardZone[]) {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const placed: { x: number; y: number }[] = [];
  return [...zones]
    .sort((p, q) => q.risk - p.risk)
    .map((z) => {
      const x = clamp(z.x, 0.1, 0.9);
      const y = clamp(z.y, 0.12, 0.88);
      const label = !placed.some((p) => Math.abs(p.y - y) < 0.12 && Math.abs(p.x - x) < 0.45);
      if (label) placed.push({ x, y });
      return { z, x, y, label, left: x > 0.55 };
    });
}

function MiniMap({ zones, w, h, fs }: { zones: CardZone[]; w: number; h: number; fs: number }) {
  const dot = (z: CardZone) => Math.round((z.kind === "danger" ? 34 + z.risk * 0.5 : 34) * (fs / 30));
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, borderRadius: 28, border: `6px solid ${INK}`, overflow: "hidden", background: "#efe2c6" }}>
      {/* water on the west edge (most of our cities are coastal; it's a doodle, not a map) */}
      <div style={{ display: "flex", position: "absolute", left: -w * 0.18, top: -h * 0.1, width: w * 0.32, height: h * 1.2, borderRadius: 9999, background: "#9fc6e8" }} />
      {[0.22, 0.45, 0.68].map((y) => (
        <div key={`h${y}`} style={{ display: "flex", position: "absolute", left: 0, top: h * y, width: w, height: 10, background: "#fff8ec", transform: `rotate(${y > 0.5 ? -4 : 3}deg)` }} />
      ))}
      {[0.3, 0.55, 0.8].map((x) => (
        <div key={`v${x}`} style={{ display: "flex", position: "absolute", top: 0, left: w * x, width: 10, height: h, background: "#fff8ec", transform: `rotate(${x > 0.6 ? 6 : -3}deg)` }} />
      ))}
      {placeLabels(zones).map(({ z, x, y, label, left }) => {
        const d = dot(z);
        const color = z.kind === "danger" ? LEVEL_COLOR.cheating : LEVEL_COLOR.armored;
        const tag = label && (
          <div style={{ display: "flex", margin: left ? "0 10px 0 0" : "0 0 0 10px", fontSize: fs, fontWeight: 800, background: "#fff8ec", border: `3px solid ${INK}`, borderRadius: 10, padding: "2px 10px" }}>
            {z.kind === "danger" ? `${z.name} ${z.risk}%` : z.name}
          </div>
        );
        return (
          <div key={z.name} style={{ display: "flex", position: "absolute", top: y * h - d / 2, alignItems: "center", flexDirection: left ? "row-reverse" : "row", ...(left ? { right: w - x * w - d / 2 } : { left: x * w - d / 2 }) }}>
            <div style={{ display: "flex", width: d, height: d, borderRadius: 9999, background: color, border: `5px solid ${INK}`, opacity: 0.92 }} />
            {tag}
          </div>
        );
      })}
    </div>
  );
}

export function Card({ d, f }: { d: CardData; f: CardFormat }) {
  const t = dictionaries[d.lang];
  const level = t.levels[d.level];
  const color = LEVEL_COLOR[d.level];
  const wide = f === "og";
  const story = f === "story";
  const W = wide ? 1200 : 1080;
  const pad = wide ? 40 : 64;
  const big = wide ? 220 : story ? 340 : 280;
  const names = (
    <div style={{ display: "flex", fontSize: wide ? 46 : 64, fontWeight: 800, gap: 16 }}>
      <span style={{ color: "#ff3b1f" }}>{d.a || "A"}</span>
      <span>×</span>
      <span style={{ color: "#2563ff" }}>{d.b || "B"}</span>
    </div>
  );
  const pct = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontSize: wide ? 40 : 58, fontWeight: 800 }}>{t.cachos}</div>
      <div style={{ display: "flex", fontSize: big, fontWeight: 800, lineHeight: 0.9, letterSpacing: -10, color }}>{`${d.pct}%`}</div>
      <div style={{ display: "flex", marginTop: 14 }}>
        <div style={{ display: "flex", fontSize: wide ? 28 : 38, fontWeight: 800, background: color, border: `5px solid ${INK}`, padding: "8px 22px", borderRadius: 14, transform: "rotate(-2deg)", color: d.level === "medium" ? INK : "#fff" }}>
          {level}
        </div>
      </div>
      <div style={{ display: "flex", fontSize: wide ? 22 : 30, marginTop: 16, fontWeight: 500, maxWidth: wide ? 560 : 950 }}>{t.cardMeasures}</div>
    </div>
  );
  const joke = d.joke && (
    <div style={{ display: "flex", flexDirection: "column", background: "#fff", border: `6px solid ${INK}`, borderRadius: 24, padding: wide ? "18px 24px" : "28px 34px", boxShadow: `10px 10px 0 ${INK}` }}>
      {d.title && <div style={{ display: "flex", fontSize: wide ? 26 : 40, fontWeight: 800, color: "#ff3b1f", marginBottom: 8 }}>{d.title}</div>}
      <div style={{ display: "flex", fontSize: wide ? 24 : story ? 42 : 36, lineHeight: 1.25, fontWeight: 500 }}>{`“${d.joke}”`}</div>
    </div>
  );
  const top = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", fontSize: wide ? 34 : 48, fontWeight: 800 }}>
        <span>CACHO</span><span style={{ color: "#ff3b1f" }}>·</span><span>MAP</span>
      </div>
      {d.city && <div style={{ display: "flex", fontSize: wide ? 24 : 32, background: INK, color: PAPER, padding: "8px 22px", borderRadius: 999 }}>{d.city}</div>}
    </div>
  );
  const foot = (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: wide ? 20 : 28, opacity: 0.85 }}>
      <span>{t.cardFooter}</span>
      <span>cacho-map.vercel.app</span>
    </div>
  );
  const frame = { width: "100%", height: "100%", display: "flex", flexDirection: "column" as const, padding: pad, background: PAPER, color: INK, fontFamily: "Bricolage", border: `18px solid ${INK}`, justifyContent: "space-between" as const };

  if (wide) {
    return (
      <div style={frame}>
        {top}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{names}{pct}</div>
          {d.zones.length > 0 && <MiniMap zones={d.zones.slice(0, 4)} w={460} h={330} fs={20} />}
        </div>
        {foot}
      </div>
    );
  }
  return (
    <div style={frame}>
      {top}
      {names}
      {pct}
      {d.zones.length > 0 && <MiniMap zones={d.zones} w={W - pad * 2 - 36} h={story ? 560 : 330} fs={story ? 30 : 24} />}
      {joke}
      {foot}
    </div>
  );
}
