import { describe, expect, it } from "vitest";
import { followUp, thinReason } from "./clarify";
import type { ParsedTaste } from "../types";

const t = (en: string, kind: ParsedTaste["kind"], places: string[] = [], domain?: ParsedTaste["domain"]): ParsedTaste => ({ input: en, label: { es: en, en }, kind, query: en, places, ...(domain && { domain }) });
const metal = t("metal", "genre", ["live_music"], "music");
const anime = t("anime", "genre", ["cinema"], "media");
const sushi = t("sushi", "food", ["sushi"], "food");
const pizza = t("pizza", "food", ["pizza"], "food");
const gym = t("gym", "activity", ["gym"]);

describe("thinReason (when the agent asks before computing)", () => {
  it("asks for more with fewer than 2 tastes", () => {
    expect(thinReason([])).toBe("few");
    expect(thinReason([metal])).toBe("few");
  });
  it("asks for music/shows when 2 tastes are only food or outings", () => {
    expect(thinReason([sushi, pizza])).toBe("media");
    expect(thinReason([sushi, gym])).toBe("media");
  });
  it("asks for food/outings when 2 media tastes lead to no places", () => {
    expect(thinReason([t("Lost", "title"), t("Dark", "title")])).toBe("places");
  });
  it("is satisfied with 2 mixed tastes or 3+", () => {
    expect(thinReason([metal, sushi])).toBeNull();
    expect(thinReason([sushi, pizza, gym])).toBeNull();
  });
});

describe("followUp", () => {
  it("asks about the thin person and offers the other's tastes as answers", () => {
    const q = followUp({ nick: "Jesús", tastes: [metal, anime, gym] }, { nick: "Karol", tastes: [sushi] });
    expect(q?.who).toBe("b");
    expect(q?.nick).toBe("Karol");
    expect(q?.reason).toBe("few");
    expect(q?.have.map((h) => h.en)).toEqual(["sushi"]);
    expect(q?.fromOther.map((h) => h.en)).toEqual(["metal", "anime", "gym"]);
  });
  it("only offers answers of the missing family", () => {
    const q = followUp({ nick: "A", tastes: [sushi, pizza] }, { nick: "B", tastes: [metal, gym, anime] });
    expect(q?.reason).toBe("media");
    expect(q?.fromOther.map((h) => h.en)).toEqual(["metal", "anime"]);
  });
  it("never asks the same person twice and returns null when both are fine", () => {
    expect(followUp({ nick: "A", tastes: [metal] }, { nick: "B", tastes: [sushi, metal] }, ["a"])).toBeNull();
    expect(followUp({ nick: "A", tastes: [metal, sushi] }, { nick: "B", tastes: [anime, pizza] })).toBeNull();
  });
});
