import { describe, expect, it } from "vitest";
import { MAX_KM, pickStops, route, scoreCandidates, tastesForPlace, type Candidate } from "./pick";
import type { TasteEntity } from "../types";

const at = { lat: 10.42, lon: -75.55 };
const taste = (name: string, kind: TasteEntity["kind"], places: string[]): TasteEntity => ({ id: name, name, type: "tag", input: name, kind, places, label: { es: name, en: name } });
const place = (id: string, genres: string[], dLat = 0.005, cuisines: string[] = [], from?: number[]): Candidate => ({ id, name: id, lat: at.lat + dLat, lon: at.lon, affinity: 0.5, tags: { genres, cuisines, ambience: [], activities: [] }, ...(from && { from }) });

// Jesús: anime (cinemas), sushi. Karol: action movies (cinemas), salsa (salsa bars).
const tastesA = [taste("anime", "genre", ["cinema"]), taste("Sushi", "food", ["sushi"])];
const tastesB = [taste("action movies", "genre", ["cinema"]), taste("salsa", "genre", ["salsa_bar"])];

describe("tastesForPlace", () => {
  it("matches by place kind and by cuisine", () => {
    expect(tastesForPlace(place("Cine", ["Movie theater"]), tastesA)).toEqual([0]);
    expect(tastesForPlace(place("Sr Miyagi", ["Restaurant"], 0, ["Sushi"]), tastesA)).toEqual([1]);
    expect(tastesForPlace(place("Bar", ["Salsa bar"]), tastesA)).toEqual([]);
  });
});

describe("pickStops (rescue plan)", () => {
  it("prefers a place that satisfies a taste of EACH person, naming both", () => {
    const cine = place("Cine Colombia", ["Movie theater"], 0.01, [], [0]);
    const sushi = place("Sushi Bar", ["Sushi restaurant"], 0.002, [], [1]);
    const salsa = place("Café Havana", ["Salsa bar"], 0.004, [], [1]);
    const stops = pickStops({ deepA: [cine, sushi], deepB: [salsa], bridge: [], tastesA, tastesB, at });
    const c = stops.find((s) => s.id === "Cine Colombia");
    expect(c?.forA).toEqual([0]);
    expect(c?.forB).toEqual([0]);
    expect(stops.length).toBeGreaterThanOrEqual(2);
  });
  it("takes turns (one stop per person) when nothing is shared", () => {
    const sushi = place("Sushi Bar", ["Sushi restaurant"], 0.002, [], [1]);
    const salsa = place("Café Havana", ["Salsa bar"], 0.004, [], [1]);
    const stops = pickStops({ deepA: [sushi], deepB: [salsa], bridge: [], tastesA: [tastesA[1]], tastesB: [tastesB[1]], at });
    expect(stops.map((s) => s.id).sort()).toEqual(["Café Havana", "Sushi Bar"]);
    expect(stops.some((s) => s.forA.length && !s.forB.length)).toBe(true);
    expect(stops.some((s) => s.forB.length && !s.forA.length)).toBe(true);
  });
  it("doesn't repeat a kind of place, skips far places and gyms lose to date spots", () => {
    const c1 = place("Cine 1", ["Movie theater"], 0.003, [], [0]);
    const c2 = place("Cine 2", ["Movie theater"], 0.004, [], [0]);
    const far = place("Lejos", ["Movie theater"], (MAX_KM + 5) / 111, [], [0]);
    const scored = scoreCandidates({ deepA: [c1, c2, far], deepB: [], bridge: [], tastesA, tastesB, at });
    expect(scored.some((s) => s.id === "Lejos")).toBe(false);
    const stops = pickStops({ deepA: [c1, c2], deepB: [], bridge: [], tastesA, tastesB, at });
    expect(stops.filter((s) => s.id.startsWith("Cine")).length).toBe(1);
    const gymA = [taste("gym", "activity", ["gym"]), taste("Sushi", "food", ["sushi"])];
    const gym = place("Smart Fit", ["Gym"], 0.001, [], [0]);
    const sushi = place("Sushi Bar", ["Sushi restaurant"], 0.002, [], [1]);
    expect(scoreCandidates({ deepA: [gym, sushi], deepB: [], bridge: [], tastesA: gymA, tastesB, at })[0].id).toBe("Sushi Bar");
  });
  it("orders stops as a route from the couple, with km per leg", () => {
    const near = { ...place("Cerca", [], 0.001), forA: [0], forB: [] };
    const farther = { ...place("Lejos", [], 0.02), forA: [], forB: [0] };
    const r = route([farther, near], at);
    expect(r.map((s) => s.id)).toEqual(["Cerca", "Lejos"]);
    expect(r[0].km).toBeCloseTo(0.1, 1);
    expect(r[1].km).toBeCloseTo(2.1, 1);
  });
});
