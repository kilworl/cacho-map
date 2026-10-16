# 🦌 Cacho-Map — Cartagena taste-incompatibility map

A playful, consent-based app for couples: two people enter their tastes (artists, movies, series, books), an AI agent powered by the **Qloo Taste API** measures how compatible they are, roasts them with a funny verdict ("54% de cachos en el Centro") and shows a Cartagena map of places where they agree (green) or clash (red). Built for the Qloo Agentic Hackathon (Sept 30 – Oct 30, 2026).

## How it works
1. `/api/match` resolves each person's tastes with Qloo `/search`.
2. Qloo `/v2/insights/compare` → shared taste tags (60% of the score).
3. Qloo `/v2/insights` (places, `Cartagena De Indias`) per person → top-25 place overlap (40%), broken down by neighborhood.
4. An AI SDK agent (Vercel AI Gateway) calls tools (`getCompatibility`, `getSharedTasteTags`, `getZoneClashes`, `getPlaces`) and writes a safe roast in Spanish and English.
5. MapLibre + OpenStreetMap map, share card via `next/og`, WhatsApp share.

Qloo calls use retry with exponential backoff (429/5xx) and a 24 h cache. No raw Qloo data is stored in the repo.

## Run
```bash
cp .env.example .env.local   # add QLOO_API_KEY (and AI_GATEWAY_API_KEY locally)
npm install && npm run dev
```
On Vercel, the AI Gateway authenticates via OIDC. Without an LLM the app falls back to a template roast.

## Safety
Nicknames only, explicit consent checkbox, no real third parties. Jokes only about tastes, never real infidelity accusations, bodies, identity or businesses.

License: MIT. Map data © OpenStreetMap contributors.
