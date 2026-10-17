# 🦌 Cacho-Map

**What's your cheating risk?** Two people type what they like (artists, movies, shows, books, food). Cacho-Map uses the **Qloo Taste AI** to find each person's favorite places in their own city and measures the **"riesgo de cacho" (cheating risk)**: how many of the plans one likes, the other doesn't. That's where one ends up going out alone... or with other company. It maps the *danger zones* and *safe zones*, and an AI agent roasts them with light cheating wordplay in Spanish or English.

Live: **https://cacho-map.vercel.app** · Built for the Qloo Agentic Hackathon (2026).

> "Cachos" is Colombian slang for horns, i.e. being cheated on ("le montaron los cachos"). The app's joke: if your plans don't overlap, you go out separately, and that's where "cacho" risk lives. It only ever measures plans, never real infidelity. Consent-based, nicknames only.

## Features

- **Works anywhere.** Uses the browser's location (reverse-geocoded with BigDataCloud's free client API) or a city picker; Cartagena is the default.
- **Qloo at the core.** Entity search, taste comparison and location-aware place recommendations drive the score, the map and every joke.
- **Zones for any city.** Neighborhoods come from Qloo place data, with nearest-neighbor and compass fallbacks (and a hand-made refinement for Cartagena).
- **Tool-calling roast agent** (AI SDK + Vercel AI Gateway) grounded in the Qloo data, with a humor guide based on research of what couple humor actually travels on X ([docs/humor.md](docs/humor.md)).
- **Cheating-risk meter** with levels (bajo / medio / alto / "ya hay cacho") and a "how is it calculated" breakdown with the real counts.
- **Danger zones vs. safe zones.** Each zone card is characterized from Qloo place data (dominant place types, cuisines, ambience tags, price) and says why it's risky or safe for this couple. A cheap LLM only *phrases* those facts (strict "use only the given facts" prompt); a deterministic template is the fallback.
- **Place popups** say what the place is (Qloo type/cuisine/short description), who it fits, and a one-line plan.
- **Live map.** OpenFreeMap vector tiles recolored to the app palette, animated pins, a heat layer showing the cheating risk per neighborhood, fly-to animations.
- **ES / EN** across UI and AI output, saved in `localStorage`, defaulting to the browser language.
- Shareable 4:5 card (`next/og`) and WhatsApp share.

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI[CachoApp<br/>React 19 + Next.js 16] --> GEO[lib/geo/locate<br/>Geolocation + BigDataCloud]
    UI --> MAP[components/map/CachoMap<br/>MapLibre + OpenFreeMap]
  end
  UI -- POST /api/match --> API[app/api/match<br/>zod validation]
  API --> SVC[lib/match/service<br/>runMatch]
  SVC --> Q1[lib/qloo/api<br/>resolveTastes: /search]
  SVC --> Q2[compareTastes:<br/>/v2/insights/compare]
  SVC --> Q3[placesNear:<br/>/v2/insights type=place<br/>POINT + radius]
  Q1 & Q2 & Q3 --> QC[lib/qloo/client<br/>retry + 24h cache]
  SVC --> Z[lib/geo/zones<br/>assignZones]
  Z --> S[lib/scoring/score<br/>pure functions]
  S --> AG[lib/agent/roast<br/>agent: tools + 3 candidates]
  AG --> J[judge<br/>flash-lite scores, drops nonsense]
  S --> EN[lib/agent/enrich<br/>zone + place copy from Qloo facts]
  AG & J & EN --> GW[(Vercel AI Gateway)]
  AG --> SAN[lib/agent/sanitize<br/>humor contract + dark filter]
  SVC --> API --> UI
  UI --> CARD[app/api/card<br/>share image]
```

```
app/                 Next.js routes (page, /api/match, /api/card, /r share page)
components/          UI: CachoApp, MatchForm, ResultView, ZoneList, LocationPicker, LoadingState…
  map/               CachoMap (MapLibre) + mapTheme (basemap, palette, heat stops)
  reactbits/         Animated components from React Bits (vendored verbatim)
lib/
  qloo/              HTTP client (retry, cache) and typed API helpers
  geo/               preset cities, distance, zone assignment, browser geolocation
  scoring/           pure scoring functions + vitest tests
  agent/             prompt, tools, roast generation, output sanitizer, template fallback
  match/             request schema (zod) and the runMatch orchestrator
  i18n/              ES/EN dictionaries + LangProvider
  text/              name normalization (ALL CAPS → Title Case)
docs/humor.md        humor research and the rules the prompt follows
```

## How Qloo is used

1. **`/search`** and **`/v2/tags`**: each free-text taste (normalized by a small LLM: "Mentalista" → The Mentalist, "comida mexicana" → Mexican cuisine tag) → a Qloo entity or tag, in parallel.
2. **`/v2/insights`** with `filter.type=urn:entity:place`, `filter.location=POINT(lon lat)` and a radius around the user, called **once per input** (up to 6 per person). Each person's favorites are a blend of those lists (`lib/scoring/blend.ts`): rank score × weight, where titles weigh 1, cuisines 0.6 and broad categories 0.3, normalized and **capped at 40% per input**, so one cuisine can't take over. Four unrelated "probe" tastes (The Lion King, Beethoven, MasterChef, The Great Gatsby) give a **popular-for-anyone baseline** per city; places in 3 of 4 probe lists are left out of the comparison. Result: each person's **top 20 places**.
3. **`/v2/insights/compare`**: shared taste tags, shown as a secondary "taste affinity" stat and given to the agent as joke material.
4. Place tags (`genre:place`, `cuisine`, `ambience`, `activity_type`), `short_description` and `price_level` feed the zone profiles and place popups.
5. The agent's tools (`getRisk`, `getSharedTasteTags`, `getZones`, `getPlaces`) expose only this Qloo-derived data, so the roast always cites real tastes and real places.

The compare call and both place calls run in parallel. Qloo calls retry on 429/5xx with exponential backoff and are cached for 24 h. No raw Qloo data is stored in the repo.

## Scoring

```
A = top 20 blended Qloo places for person 1, B = same for person 2 (popular-for-anyone places removed)
risk  = round( ( |A \ B| / |A|  +  |B \ A| / |B| ) / 2 × 100 )
        "X% of the plans one likes, the other doesn't"
level = bajo < 35 ≤ medio < 60 ≤ alto < 80 ≤ "ya hay cacho"
zone risk = places in the zone only one of them likes / places in the zone
zone kind = danger if zone risk ≥ 50%, else safe (both would go)
tag affinity (secondary) = rescale(mean Qloo tag score, 0.50 → 0, 0.73 → 100) × min(1, tags / 40)
```

The roast may only quote the overall %. The agent writes 3 candidates using 3 rotating few-shot examples from a curated bank (`lib/agent/examples.ts`, never ones about the couple's own tastes). A judge (`gemini-2.5-flash`, the strongest free-tier model) checks each one for makes-sense, real wordplay, punchline at the end, no contradiction and safety, rates funniness and force-ranks them. Anything failing a criterion or below 3/5 is rejected; if none passes, the agent regenerates once (time permitting).

**Pronouns.** Each person picks él/ella/elle (he/she/they), neutral by default. They go into every prompt (roast, plan, zone and place copy), and `lib/agent/gender.ts` fixes "solo/sola" to the right form ("sin compañía" for neutral) and drops sentences with pronouns nobody uses.

## Run locally

```bash
cp .env.example .env.local   # add QLOO_API_KEY and, locally, AI_GATEWAY_API_KEY
npm install                  # also copies the MapLibre worker into public/vendor
npm run dev
npm test                     # vitest: risk scoring, zones, sanitizer, zone/place templates, judge
npm run lint && npm run typecheck
```

On Vercel the AI Gateway authenticates with OIDC. `AI_MODEL` overrides the default model (`google/gemini-2.5-flash`). Without an LLM the app falls back to a template roast.

## Safety

Nicknames only and an explicit consent checkbox. Jokes are light cheating *wordplay* about plans and tastes: never real accusations, explicit content, bodies, sexuality, religion, politics, real third parties, or trashing a business. The output sanitizer enforces the % rule, strips banned phrasing and drops any sentence with dark or violent imagery.

## Credits

- Taste data: [Qloo](https://www.qloo.com).
- Animated UI pieces from **[React Bits](https://reactbits.dev)** by David Haz: `CountUp`, `RotatingText`, `ShinyText`, `TiltedCard`, `ClickSpark` (in `components/reactbits/`).
- Map tiles: [OpenFreeMap](https://openfreemap.org), © [OpenMapTiles](https://www.openmaptiles.org/), data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
- Reverse geocoding: [BigDataCloud](https://www.bigdatacloud.com) free client API.
- Font: Bricolage Grotesque and JetBrains Mono (SIL Open Font License).

License: MIT.
