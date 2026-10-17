"use client";
import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { CityContext, GeoPoint, MatchResult, ZoneStat } from "@/lib/types";
import { DEFAULT_CITY } from "@/lib/geo/cities";
import { useI18n } from "@/lib/i18n/LangProvider";
import type { ErrorCode } from "@/lib/i18n/dict";
import ShinyText from "./reactbits/ShinyText";
import { Logo } from "./Logo";
import { LangToggle } from "./LangToggle";
import { LocationPicker } from "./LocationPicker";
import { EMPTY_FORM, MatchForm, type FormValues } from "./MatchForm";
import { LoadingState } from "./LoadingState";
import { ResultView } from "./ResultView";

const CachoMap = dynamic(() => import("./map/CachoMap"), { ssr: false, loading: () => <div className="map-canvas map-skeleton" /> });

type State = { kind: "idle" } | { kind: "loading" } | { kind: "error"; code: ErrorCode } | { kind: "done"; result: MatchResult };

export function CachoApp() {
  const { t, lang } = useI18n();
  const [city, setCity] = useState<CityContext>(DEFAULT_CITY);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [focus, setFocus] = useState<(GeoPoint & { key: string }) | null>(null);

  const run = useCallback(async () => {
    setState({ kind: "loading" });
    setFocus(null);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ consent: form.consent, lang, city, a: { nick: form.an, tastes: form.at }, b: { nick: form.bn, tastes: form.bt } }),
      });
      const data = await res.json();
      if (!res.ok) setState({ kind: "error", code: (data.error as ErrorCode) in t.errors ? data.error : "busy" });
      else setState({ kind: "done", result: data as MatchResult });
    } catch {
      setState({ kind: "error", code: "network" });
    }
  }, [form, lang, city, t.errors]);

  const result = state.kind === "done" ? state.result : null;
  const labels = useMemo(
    () => ({ both: t.legendBoth, a: t.legendOnly(result?.a ?? "A"), b: t.legendOnly(result?.b ?? "B") }),
    [t, result?.a, result?.b],
  );
  const onZone = useCallback((z: ZoneStat) => setFocus({ lat: z.lat, lon: z.lon, key: `${z.zone}-${Date.now()}` }), []);

  return (
    <div className="shell">
      <header className="topbar">
        <Logo />
        <LangToggle />
      </header>

      <main className="layout">
        <section className="panel">
          {state.kind !== "done" && (
            <div className="hero">
              <p className="tagline"><ShinyText text={t.tagline} color="#5b4a3c" shineColor="#ff3b1f" speed={4} /></p>
              <h1>
                {t.heroTitle[0]}<em>{t.heroTitle[1]}</em>{t.heroTitle[2]}
              </h1>
              <p className="intro">{t.intro}</p>
              <ol className="how">
                {t.howItWorks.map((step, i) => (
                  <li key={step}><b>{i + 1}</b>{step}</li>
                ))}
              </ol>
            </div>
          )}

          <LocationPicker city={city} onChange={setCity} />

          {state.kind === "loading" && <LoadingState />}
          {(state.kind === "idle" || state.kind === "error") && (
            <>
              <MatchForm values={form} onChange={setForm} onSubmit={run} busy={false} />
              {state.kind === "error" && <p className="error" role="alert">{t.errors[state.code]}</p>}
            </>
          )}
          {result && (
            <>
              {result.lang !== lang && (
                <button type="button" className="btn btn--ghost regen" onClick={run}>{t.regen}</button>
              )}
              <ResultView r={result} onZone={onZone} onReset={() => setState({ kind: "idle" })} />
            </>
          )}
        </section>

        <aside className="map-panel" id="map">
          <CachoMap center={result?.city ?? city} pins={result?.pins ?? []} zones={result?.zones ?? []} labels={labels} focus={focus} />
          {!result && <p className="map-empty">{t.emptyMap}</p>}
          {result && (
            <p className="map-heat">
              <span className="heat-scale" aria-hidden="true" /> {t.heat}
            </p>
          )}
        </aside>
      </main>

      <footer className="foot">
        {t.footer} <a href="https://www.qloo.com" target="_blank" rel="noreferrer">Qloo</a> · UI bits from{" "}
        <a href="https://reactbits.dev" target="_blank" rel="noreferrer">React Bits</a> ·{" "}
        <a href="https://github.com/kilworl/cacho-map" target="_blank" rel="noreferrer">GitHub</a>
      </footer>
    </div>
  );
}
