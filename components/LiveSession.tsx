"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { AgentStep, FollowUp, GeoPoint, MatchResult, Pronoun, ZoneStat } from "@/lib/types";
import type { LiveStatus, Side } from "@/lib/live/session";
import { useI18n } from "@/lib/i18n/LangProvider";
import { Logo } from "./Logo";
import { LangToggle } from "./LangToggle";
import { LoadingState } from "./LoadingState";
import { AgentTrace } from "./AgentTrace";
import { FollowUpCard } from "./FollowUpCard";
import { ResultView } from "./ResultView";
import { QrCode } from "./QrCode";
import { ShareActions } from "./ShareActions";
import { Footer } from "./Footer";
import { useResultPins } from "./useResultPins";
import ClickSpark from "./reactbits/ClickSpark";
import ShinyText from "./reactbits/ShinyText";

const CachoMap = dynamic(() => import("./map/CachoMap"), { ssr: false, loading: () => <div className="map-canvas map-skeleton" /> });
const POLL_MS = 2500;
const PRONOUNS: Pronoun[] = ["n", "f", "m"];

type Status = Omit<LiveStatus, "result"> & { result?: MatchResult; trace?: AgentStep[] };

/** One phone of a live room: my own form, then waiting, then the shared reveal. */
export function LiveSession({ id, side: wanted }: { id: string; side?: Side }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [missing, setMissing] = useState(false);
  const [sent, setSent] = useState(false);
  const [nick, setNick] = useState("");
  const [pronoun, setPronoun] = useState<Pronoun>("n");
  const [tastes, setTastes] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState<FollowUp | null>(null);
  const [focus, setFocus] = useState<(GeoPoint & { key: string }) | null>(null);
  const [origin, setOrigin] = useState("");
  const storeKey = `cacho-live:${id}`;

  // Which person this phone is: ?p=a|b, else whichever slot is still free.
  const side: Side | undefined = wanted ?? (status ? (!status.a.done ? "a" : !status.b.done ? "b" : undefined) : undefined);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state after hydration
    setOrigin(window.location.origin);
    if (side && localStorage.getItem(`${storeKey}:${side}`)) setSent(true);
  }, [side, storeKey]);

  const poll = useCallback(async () => {
    const res = await fetch(`/api/live/${id}?lang=${lang}`, { cache: "no-store" }).catch(() => null);
    if (!res) return;
    if (res.status === 404) return setMissing(true);
    if (res.ok) setStatus(await res.json());
  }, [id, lang]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first fetch, then poll
    void poll();
    const done = status?.state === "done" && status.result?.lang === lang;
    if (done || status?.state === "error") return;
    const h = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(h);
  }, [poll, status?.state, status?.result?.lang, lang]);

  const submit = async (extra = "", asked = false) => {
    if (!side) return;
    setBusy(true);
    setErr(null);
    const text = extra ? `${tastes.trim()}, ${extra}` : tastes;
    if (extra) setTastes(text);
    try {
      const res = await fetch(`/api/live/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ consent, side, nick, pronoun, tastes: text, asked }) });
      const data = await res.json();
      if (res.status === 409) setErr(t.liveTaken);
      else if (!res.ok) setErr(data.error === "consent" ? t.errors.consent : t.errors.busy);
      else if (data.followUp) setQ(data.followUp as FollowUp);
      else {
        setQ(null);
        setSent(true);
        localStorage.setItem(`${storeKey}:${side}`, "1");
        void poll();
      }
    } catch {
      setErr(t.errors.network);
    } finally {
      setBusy(false);
    }
  };

  const result = status?.result && status.result.lang === lang ? status.result : null;
  const pins = useResultPins(result, lang);
  const onZone = useCallback((z: ZoneStat) => setFocus({ lat: z.lat, lon: z.lon, key: `${z.zone}-${Date.now()}` }), []);
  const onFocus = useCallback((p: GeoPoint) => {
    setFocus({ lat: p.lat, lon: p.lon, key: `${p.lat},${p.lon}-${Date.now()}` });
    document.getElementById("map")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);
  const mineDone = !!side && (sent || !!status?.[side].done);
  const joinB = `${origin}/live/${id}?p=b`;
  const labels = { both: t.legendBoth, a: t.legendOnly(result?.a ?? "A"), b: t.legendOnly(result?.b ?? "B") };
  const nicks = { a: status?.a.nick ?? "A", b: status?.b.nick ?? "B" };

  let body: React.ReactNode;
  if (missing) body = <p className="error" role="alert">{t.liveNotFound}</p>;
  else if (!status) body = <LoadingState />;
  else if (result) body = <ResultView r={result} onZone={onZone} onFocus={onFocus} onReset={() => router.push("/")} link={`${origin}/live/${id}`} resetLabel={t.liveNew} />;
  else if (status.state === "error") body = <p className="error" role="alert">{t.liveFailed}</p>;
  else if (status.state === "computing" || (status.state === "done" && !result)) {
    body = (
      <>
        <p className="live-banner">{status.state === "done" ? t.liveTranslating : t.liveComputing}</p>
        <LoadingState />
        {status.trace && status.trace.length > 0 && <AgentTrace steps={status.trace} nicks={nicks} live />}
      </>
    );
  } else if (q) body = <FollowUpCard q={q} onAnswer={(x) => void submit(x, true)} />;
  else if (!side) body = <p className="error" role="alert">{t.liveTaken}</p>;
  else if (!mineDone) {
    body = (
      <form className="form live-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <p className="hint">{side === "a" ? t.liveYouA : t.liveInvited}</p>
        <fieldset className={`player player--${side}`}>
          <legend>{side === "a" ? t.personA : t.personB}</legend>
          <div className="nick-row">
            <input required maxLength={24} placeholder={t.liveYourNick} value={nick} onChange={(e) => setNick(e.target.value)} aria-label={t.liveYourNick} />
            <div className="pronoun" role="radiogroup" aria-label={t.pronounLabel}>
              {PRONOUNS.map((pr) => (
                <button key={pr} type="button" role="radio" aria-checked={pronoun === pr} className={pronoun === pr ? "on" : ""} onClick={() => setPronoun(pr)}>{t.pronouns[pr]}</button>
              ))}
            </div>
          </div>
          <textarea required rows={3} maxLength={500} placeholder={side === "a" ? t.tastesA : t.tastesB} value={tastes} onChange={(e) => setTastes(e.target.value)} aria-label={t.liveYourTastes} />
          <p className="fine">🔒 {t.liveSecret}</p>
        </fieldset>
        <label className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
          <span>{t.liveConsent}</span>
        </label>
        <ClickSpark sparkColor={["#ff3b1f", "#ffc21a", "#2563ff"]} sparkCount={10} sparkRadius={28} shape="star">
          <button className="cta" disabled={busy}>{t.liveSubmit} <span aria-hidden="true">→</span></button>
        </ClickSpark>
        {err && <p className="error" role="alert">{err}</p>}
      </form>
    );
  } else {
    body = (
      <div className="live-wait">
        <p className="live-banner">{t.liveWaiting}</p>
        <div className="live-players">
          {(["a", "b"] as const).map((s) => (
            <div key={s} className={`live-player live-player--${s} ${status[s].done ? "is-done" : "is-typing"}`}>
              <span className="live-avatar" aria-hidden="true">{status[s].done ? "✓" : "…"}</span>
              <span>{status[s].done ? t.liveDone(status[s].nick ?? (s === "a" ? t.personA : t.personB)) : `${s === "a" ? t.personA : t.personB}: ${t.liveTyping}`}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Person 1 keeps the invite visible until person 2 is in.
  const invite = side === "a" && status && !status.b.done && !missing && origin && (
    <section className="live-invite">
      <h3>{t.liveShareTitle}</h3>
      <div className="live-invite-row">
        <QrCode value={joinB} label={t.liveShareTitle} />
        <div>
          <code className="live-link">{joinB}</code>
          <p className="fine">{t.liveShareHint}</p>
        </div>
      </div>
      <ShareActions url={joinB} text={t.liveInvited} />
    </section>
  );

  return (
    <div className="shell">
      <header className="topbar">
        <Logo />
        <LangToggle />
      </header>
      <main className="layout">
        <section className="panel">
          {!result && (
            <div className="hero hero--live">
              <p className="tagline"><ShinyText text={t.liveRoom} color="#5b4a3c" shineColor="#ff3b1f" speed={3} /></p>
              <h1>{t.heroTitle[0]}<em>{t.heroTitle[1]}</em>{t.heroTitle[2]}</h1>
              {status && <p className="fine">📍 {status.city.name}</p>}
            </div>
          )}
          {invite}
          {body}
        </section>
        <aside className="map-panel" id="map">
          <CachoMap label={t.mapLabel} center={result?.city ?? status?.city ?? { lat: 10.4236, lon: -75.5453 }} pins={pins} zones={result?.zones ?? []} labels={labels} focus={focus} route={result?.rescue?.stops} />
          {result && <p className="map-heat"><span className="heat-scale" aria-hidden="true" /> {t.heat}</p>}
        </aside>
      </main>
      <Footer />
    </div>
  );
}
