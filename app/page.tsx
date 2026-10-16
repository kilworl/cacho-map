"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
const Map = dynamic(() => import("./Map"), { ssr: false });
export default function Home() {
  const [f, setF] = useState({ an: "", at: "", bn: "", bt: "", consent: false });
  const [r, setR] = useState<any>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(""); setR(null);
    const res = await fetch("/api/match", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ consent: f.consent, a: { nick: f.an, tastes: f.at }, b: { nick: f.bn, tastes: f.bt } }) });
    const d = await res.json(); setBusy(false); d.error ? setErr(d.error) : setR(d);
  }
  const zone = r?.zones?.[0]?.zone || "Cartagena";
  const q = r ? new URLSearchParams({ a: r.a, b: r.b, p: String(r.cachos), z: zone, t: r.roast.roast_es }).toString() : "";
  const shareUrl = r ? `${location.origin}/r?${q}` : "";
  const wa = r ? `https://wa.me/?text=${encodeURIComponent(`${r.roast.titulo} 😂 ${shareUrl}`)}` : "";
  return (
    <main>
      <h1>🦌 Cacho-Map</h1>
      <p className="sub">¿Qué tan compatibles son sus gustos en Cartagena? La IA de gustos de Qloo los compara y les dice dónde se pelearían.</p>
      <form onSubmit={go}>
        {(["a", "b"] as const).map((k) => (
          <fieldset key={k}>
            <input required maxLength={24} placeholder={k === "a" ? "Apodo 1 (ej: La Mona)" : "Apodo 2 (ej: El Flaco)"} value={(f as any)[k + "n"]} onChange={(e) => setF({ ...f, [k + "n"]: e.target.value })} />
            <textarea required rows={2} placeholder={k === "a" ? "Gustos: Bad Bunny, Rápidos y Furiosos, Karol G" : "Gustos: Radiohead, Amélie, Carlos Vives"} value={(f as any)[k + "t"]} onChange={(e) => setF({ ...f, [k + "t"]: e.target.value })} />
          </fieldset>
        ))}
        <label className="consent"><input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} required /> Los dos estamos de acuerdo: esto es un chiste entre nosotros. Solo apodos, nada de terceros.</label>
        <button disabled={busy}>{busy ? "Calculando cachos… 🦌" : "Calcular mis cachos"}</button>
      </form>
      {err && <p className="err">{err}</p>}
      {r && (
        <section>
          <div className="big">{r.cachos}%</div>
          <h2>{r.roast.titulo}</h2>
          <p>{r.roast.roast_es}</p>
          <p className="en">🇺🇸 {r.roast.roast_en}</p>
          <p>💚 {r.roast.plan_juntos_es}</p>
          <p className="small">Compatibilidad {r.compat}% · gustos {r.tagScore}% · lugares {r.placeScore}% ({r.shared} en común) · Qloo: {r.tastesA.map((t: any) => t.name).join(", ")} vs {r.tastesB.map((t: any) => t.name).join(", ")}{r.missing?.length ? ` · no reconocí: ${r.missing.join(", ")}` : ""}</p>
          <Map pins={r.pins} a={r.a} b={r.b} />
          <p className="small">🟢 coinciden · 🔴 solo uno lo escogería</p>
          <ul className="zones">{r.zones.slice(0, 5).map((z: any) => <li key={z.zone}><b>{z.zone}</b>: no coinciden en {z.cachos}% de sus lugares ({z.n})</li>)}</ul>
          <img src={`/api/card?${q}`} alt="Tarjeta para compartir" style={{ width: "100%", borderRadius: 16 }} />
          <a className="btn" href={wa} target="_blank" rel="noreferrer">Compartir por WhatsApp</a>
        </section>
      )}
      <footer>Hecho en Cartagena · Gustos y lugares por <a href="https://www.qloo.com">Qloo</a> · Es un juego, no un detector de infidelidad.</footer>
    </main>
  );
}
