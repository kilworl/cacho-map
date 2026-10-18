"use client";
import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import type { AgentStep, CityContext, FollowUp, GeoPoint, Lang, MatchResult, ZoneStat } from "@/lib/types";
import { DEFAULT_CITY } from "@/lib/geo/cities";
import { useI18n } from "@/lib/i18n/LangProvider";
import type { ErrorCode } from "@/lib/i18n/dict";
import { streamMatch, upsertStep } from "@/lib/match/client";
import ShinyText from "./reactbits/ShinyText";
import { Logo } from "./Logo";
import { LangToggle } from "./LangToggle";
import { LocationPicker } from "./LocationPicker";
import { EMPTY_FORM, MatchForm, type FormValues } from "./MatchForm";
import { LoadingState } from "./LoadingState";
import { ResultView } from "./ResultView";
import { AgentTrace } from "./AgentTrace";
import { FollowUpCard } from "./FollowUpCard";
import { LiveStart } from "./LiveStart";
import { useResultPins } from "./useResultPins";
import { Footer } from "./Footer";

const CachoMap = dynamic(() => import("./map/CachoMap"), { ssr: false, loading: () => <div className="map-canvas map-skeleton" /> });

type State =
  | { kind: "idle" }
  | { kind: "loading"; steps: AgentStep[] }
  | { kind: "question"; q: FollowUp; asked: ("a" | "b")[]; steps: AgentStep[] }
  | { kind: "error"; code: ErrorCode }
  | { kind: "done"; result: MatchResult };

type Mode = "solo" | "live";

export function CachoApp() {
  const { t, lang } = useI18n();
  const [city, setCity] = useState<CityContext>(DEFAULT_CITY);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [mode, setMode] = useState<Mode>("solo");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [focus, setFocus] = useState<(GeoPoint & { key: string }) | null>(null);

  const run = useCallback(async (l: Lang = lang, asked: ("a" | "b")[] = [], f: FormValues = form) => {
    setState({ kind: "loading", steps: [] });
    setFocus(null);
    let steps: AgentStep[] = [];
    const body = { consent: f.consent, lang: l, city, asked, a: { nick: f.an, tastes: f.at, pronoun: f.ap }, b: { nick: f.bn, tastes: f.bt, pronoun: f.bp } };
    const out = await streamMatch(body, (s) => {
      steps = upsertStep(steps, s);
      setState({ kind: "loading", steps });
    });
    if (out.type === "result") setState({ kind: "done", result: out.result });
    else if (out.type === "question") setState({ kind: "question", q: out.followUp, asked, steps });
    else setState({ kind: "error", code: out.error in t.errors ? (out.error as ErrorCode) : "busy" });
  }, [form, lang, city, t.errors]);

  /** The person's answer is appended to their tastes; that side is never asked again. */
  const answer = (q: FollowUp, asked: ("a" | "b")[], extra: string) => {
    const key = q.who === "a" ? "at" : "bt";
    const next = extra ? { ...form, [key]: form[key].trim() ? `${form[key].trim()}, ${extra}` : extra } : form;
    setForm(next);
    void run(lang, [...asked, q.who], next);
  };

  const result = state.kind === "done" ? state.result : null;
  const labels = { both: t.legendBoth, a: t.legendOnly(result?.a ?? "A"), b: t.legendOnly(result?.b ?? "B") };
  const pins = useResultPins(result, lang);
  const onZone = useCallback((z: ZoneStat) => setFocus({ lat: z.lat, lon: z.lon, key: `${z.zone}-${Date.now()}` }), []);
  const onFocus = useCallback((p: GeoPoint) => {
    setFocus({ lat: p.lat, lon: p.lon, key: `${p.lat},${p.lon}-${Date.now()}` });
    document.getElementById("map")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);
  const nicks = { a: form.an || "A", b: form.bn || "B" };

  return (
    <div className="shell">
      <header className="topbar">
        <Logo />
        <LangToggle onSwitch={(l) => { if (result && result.lang !== l) void run(l); }} />
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

          {(state.kind === "idle" || state.kind === "error") && (
            <div className="modes" role="tablist">
              {(["solo", "live"] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>
                  {m === "solo" ? t.modeSolo : t.modeLive}
                </button>
              ))}
            </div>
          )}

          <LocationPicker city={city} onChange={setCity} />

          {state.kind === "loading" && (
            <>
              <LoadingState />
              <AgentTrace steps={state.steps} nicks={nicks} live />
            </>
          )}
          {state.kind === "question" && (
            <>
              <FollowUpCard q={state.q} onAnswer={(x) => answer(state.q, state.asked, x)} />
              <AgentTrace steps={state.steps} nicks={nicks} />
            </>
          )}
          {(state.kind === "idle" || state.kind === "error") && (mode === "solo" ? (
            <>
              <MatchForm values={form} onChange={setForm} onSubmit={() => void run()} busy={false} />
              {state.kind === "error" && <p className="error" role="alert">{t.errors[state.code]}</p>}
            </>
          ) : (
            <LiveStart city={city} />
          ))}
          {result && <ResultView r={result} onZone={onZone} onFocus={onFocus} onReset={() => setState({ kind: "idle" })} />}
        </section>

        <aside className="map-panel" id="map">
          <CachoMap label={t.mapLabel} center={result?.city ?? city} pins={pins} zones={result?.zones ?? []} labels={labels} focus={focus} route={result?.rescue?.stops} />
          {!result && <p className="map-empty">{t.emptyMap}</p>}
          {result && (
            <p className="map-heat">
              <span className="heat-scale" aria-hidden="true" /> {t.heat}
            </p>
          )}
        </aside>
      </main>

      <Footer />
    </div>
  );
}
