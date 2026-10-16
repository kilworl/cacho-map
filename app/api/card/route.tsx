import { ImageResponse } from "next/og";
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const g = (k: string, n = 140) => (u.get(k) || "").slice(0, n);
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 70, background: "linear-gradient(160deg,#ff3d6e,#ffb238)", color: "white", fontFamily: "sans-serif" }}>
      <div style={{ fontSize: 44, fontWeight: 800, display: "flex" }}>🦌 Cacho-Map · Cartagena</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 56, display: "flex" }}>{g("a", 24)} ❤️ {g("b", 24)}</div>
        <div style={{ fontSize: 230, fontWeight: 900, lineHeight: 1, display: "flex" }}>{g("p", 3)}%</div>
        <div style={{ fontSize: 54, fontWeight: 700, display: "flex" }}>de cachos en {g("z", 30)}</div>
        <div style={{ fontSize: 38, marginTop: 30, display: "flex" }}>{g("t", 220)}</div>
      </div>
      <div style={{ fontSize: 30, opacity: 0.9, display: "flex" }}>Es un chiste entre los dos 😜 · Powered by Qloo taste AI</div>
    </div>, { width: 1080, height: 1350 });
}
