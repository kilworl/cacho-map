import { describe, expect, it } from "vitest";
import { CARD_SIZES, cardZones, isCardFormat, parseCard } from "./params";
import type { ZoneStat } from "../types";

const zone = (name: string, lat: number, lon: number, risk: number, kind: ZoneStat["kind"]): ZoneStat => ({ zone: name, lat, lon, riskPct: risk, kind, n: 3, both: 0, a: 2, b: 1, profile: { genres: [], cuisines: [], ambience: [] } });

describe("share card params", () => {
  it("has story, post and X/OG sizes", () => {
    expect(CARD_SIZES.story).toEqual({ width: 1080, height: 1920 });
    expect(CARD_SIZES.og).toEqual({ width: 1200, height: 630 });
    expect(isCardFormat("story")).toBe(true);
    expect(isCardFormat("poster")).toBe(false);
  });
  it("places zones on the mini map with north up", () => {
    const zs = cardZones([zone("Norte", 10.5, -75.5, 80, "danger"), zone("Sur", 10.3, -75.5, 10, "safe")]);
    expect(zs[0].y).toBeLessThan(zs[1].y);
    expect(zs.every((z) => z.x >= 0 && z.x <= 1 && z.y >= 0 && z.y <= 1)).toBe(true);
  });
  it("round-trips through the URL and caps hostile input", () => {
    const q = new URLSearchParams({ a: "Jesús<script>", b: "Karol", p: "81", lv: "cheating", c: "Cartagena", t: "x".repeat(500), l: "en", zs: "Getsemaní~90~d~0.2~0.3|Manga~5~s~2~-1|bad~x~d~a~b" });
    const d = parseCard(q);
    expect(d.a).toBe("Jesússcript");
    expect(d.pct).toBe(81);
    expect(d.level).toBe("cheating");
    expect(d.lang).toBe("en");
    expect(d.joke.length).toBe(220);
    expect(d.zones).toHaveLength(2);
    expect(d.zones[1]).toMatchObject({ name: "Manga", kind: "safe", x: 1, y: 0 });
  });
  it("derives the level from the % when missing (5% = pareja blindada)", () => {
    expect(parseCard(new URLSearchParams({ p: "5" })).level).toBe("armored");
    expect(parseCard(new URLSearchParams({ p: "62" })).level).toBe("high");
    expect(parseCard(new URLSearchParams({ p: "999" })).pct).toBe(100);
  });
});

describe("placeLabels", () => {
  it("clamps pins inside the frame, flips labels on the right and drops overlapping labels", async () => {
    const { placeLabels } = await import("./layout");
    const out = placeLabels([
      { name: "A", risk: 90, kind: "danger", x: 0.2, y: 0.2 },
      { name: "B", risk: 50, kind: "danger", x: 0.22, y: 0.24 },
      { name: "C", risk: 80, kind: "danger", x: 0.99, y: 0.99 },
    ] as never);
    const by = Object.fromEntries(out.map((o) => [o.z.name, o]));
    expect(by.C.x).toBe(0.9);
    expect(by.C.left).toBe(true);
    expect(by.A.label).toBe(true);
    expect(by.B.label).toBe(false);
  });
});
