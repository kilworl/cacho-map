import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Bricolage Grotesque (SIL OFL), static weights for Satori.
const fonts = Promise.all(
  [500, 800].map(async (weight) => ({
    name: "Bricolage",
    data: await readFile(join(process.cwd(), `assets/fonts/Bricolage-${weight}.ttf`)),
    weight: weight as 500 | 800,
    style: "normal" as const,
  })),
);

/** 1080x1350 share card (Instagram/WhatsApp friendly). Inputs are query params, truncated. */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const g = (k: string, n = 140) => (u.get(k) || "").slice(0, n);
  const en = g("l", 2) === "en";
  const zone = g("z", 30);
  const city = g("c", 30);
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: "#f6ecd9", color: "#1a1410", fontFamily: "Bricolage", border: "18px solid #1a1410" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 46, fontWeight: 800, display: "flex" }}>CACHO·MAP</div>
        <div style={{ fontSize: 30, display: "flex", background: "#1a1410", color: "#f6ecd9", padding: "8px 22px", borderRadius: 999 }}>{city || "📍"}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 58, fontWeight: 800, display: "flex", gap: 18 }}>
          <span style={{ color: "#ff3b1f" }}>{g("a", 24)}</span>
          <span>×</span>
          <span style={{ color: "#2563ff" }}>{g("b", 24)}</span>
        </div>
        <div style={{ fontSize: 300, fontWeight: 800, lineHeight: 0.9, display: "flex", color: "#ff3b1f", letterSpacing: -12 }}>{g("p", 3)}%</div>
        <div style={{ fontSize: 60, fontWeight: 800, display: "flex" }}>{en ? "taste-cheating" : "de cachos"}</div>
        {zone && (
          <div style={{ display: "flex", marginTop: 22 }}>
            <div style={{ fontSize: 34, display: "flex", background: "#ffc21a", border: "4px solid #1a1410", padding: "8px 20px", transform: "rotate(-2deg)" }}>
              {en ? `Battlefield: ${zone}` : `Zona de guerra: ${zone}`}
            </div>
          </div>
        )}
        <div style={{ fontSize: 40, marginTop: 40, display: "flex", lineHeight: 1.25, fontWeight: 500 }}>“{g("t", 220)}”</div>
      </div>
      <div style={{ fontSize: 28, display: "flex", justifyContent: "space-between", opacity: 0.85 }}>
        <span>{en ? "Just a joke between us" : "Es un chiste entre los dos"}</span>
        <span>Powered by Qloo taste AI</span>
      </div>
    </div>,
    { width: 1080, height: 1350, fonts: await fonts },
  );
}
