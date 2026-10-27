import { describe, expect, it } from "vitest";
import { BOTH_TASTES_BONUS, passes, pickBest, type Verdict } from "./roast";
import { isHedged } from "./sanitize";
import { ANGLES, pickAngles } from "./examples";

const v = (index: number, over: Partial<Verdict> = {}): Verdict => ({
  index, facts_cited: [], double_meaning: "rolls: sushi / excuses", pun_is_real: true, hedged: false, uses_both_tastes: false,
  makes_sense: true, wordplay: true, punchline_at_end: true, no_contradiction: true, safe: true, funny: 4, ...over,
});

describe("stricter joke judge", () => {
  it("rejects the nonsense sushi joke that used to pass (hedged punchline)", () => {
    expect(isHedged("If he says he's out 'rolling with his homies,' maybe he's having sushi, or he's just rolling out.")).toBe(true);
    expect(isHedged("Jesús dice que va al gym, o simplemente se fue con otro plan.")).toBe(true);
  });
  it("does not flag normal jokes", () => {
    expect(isHedged("Karol ve Friends: si la pillan, ya tiene la excusa lista, estábamos en un break.")).toBe(false);
    expect(isHedged("Jesús loves Metallica and Karol reggaeton: or rather, Karol loves dancing without him.")).toBe(false);
  });
  it("fails a verdict without a real double meaning, or hedged", () => {
    expect(passes(v(0))).toBe(true);
    expect(passes(v(0, { pun_is_real: false }))).toBe(false);
    expect(passes(v(0, { hedged: true }))).toBe(false);
    expect(passes(v(0, { double_meaning: "" }))).toBe(false);
    expect(passes(v(0, { double_meaning: "it's funny" }))).toBe(false);
  });
  it("prefers jokes that play both people's tastes (variety)", () => {
    const { best, totals } = pickBest(["solo", "both"], [v(0, { funny: 4 }), v(1, { funny: 4, uses_both_tastes: true })], [0, 1]);
    expect(best).toBe("both");
    expect(totals[1] - totals[0]).toBe(BOTH_TASTES_BONUS - 1);
  });
  it("gives the 3 candidates 3 different angles, the clash one first", () => {
    const xs = pickAngles("en", 3, () => 0.3);
    expect(xs).toHaveLength(3);
    expect(new Set(xs).size).toBe(3);
    expect(xs[0]).toBe(ANGLES[0].en);
    expect(pickAngles("es")[0]).toBe(ANGLES[0].es);
  });
});

describe("model output cleanup", () => {
  it("strips control characters from titles", async () => {
    const { sanitizeRoast } = await import("./sanitize");
    expect(sanitizeRoast({ title: "Riesgo de cacho: 5% \b · El ritmo de los dos", roast: "Ana y Leo bailan salsa juntos siempre.", plan: "" }, 5, "es").title).toBe("Riesgo de cacho: 5% · El ritmo de los dos");
  });
});

describe("looser joke selection", () => {
  it("still picks a safe joke when soft comedy criteria fail", () => {
    const c = ["weak", "unsafe", "wrong"];
    const { best, totals } = pickBest(
      c,
      [v(0, { wordplay: false, pun_is_real: false, double_meaning: "", funny: 2 }), v(1, { safe: false }), v(2, { makes_sense: false })],
      [0, 1, 2],
    );
    expect(best).toBe("weak");
    expect(totals[0]).toBeGreaterThan(0);
    expect(totals[1]).toBe(-1);
    expect(totals[2]).toBe(-1);
  });
  it("returns null only when every candidate fails the hard gate", () => {
    expect(pickBest(["a", "b"], [v(0, { safe: false }), v(1, { hedged: true })], [0, 1]).best).toBeNull();
  });
});
