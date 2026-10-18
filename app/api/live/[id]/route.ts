import { after, NextResponse } from "next/server";
import { LiveSubmit } from "@/lib/match/schema";
import { getStore } from "@/lib/live/store";
import { computeSession, getStatus, isSessionId, markRun, SessionNotFound, shouldCompute, SideTaken, submitSide } from "@/lib/live/session";
import { liveRunner, parseOne } from "@/lib/live/runner";
import type { Lang } from "@/lib/types";

export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

/** Kicks off the match after the response is sent (both phones poll for it). */
async function startCompute(id: string, lang: Lang) {
  const store = getStore();
  await markRun(store, id, lang);
  after(() => computeSession(store, id, lang, liveRunner));
}

/** GET /api/live/[id]?lang=es: who is done, then the shared result. Never exposes tastes before the reveal. */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isSessionId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const l = new URL(req.url).searchParams.get("lang");
  try {
    const s = await getStatus(getStore(), id, l === "es" || l === "en" ? l : undefined);
    // A poll also (re)starts the compute: covers both phones submitting at once, or a run that died.
    if (shouldCompute(s)) {
      await startCompute(id, s.lang);
      s.state = "computing";
    }
    const { run: _run, ...out } = s;
    void _run;
    return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof SessionNotFound) return NextResponse.json({ error: "not_found" }, { status: 404 });
    console.error("live status failed:", (e as Error).message);
    return NextResponse.json({ error: "busy" }, { status: 502 });
  }
}

/** POST /api/live/[id]: one person sends their own tastes (may get a follow-up question back). */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isSessionId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const parsed = LiveSubmit.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const consent = parsed.error.issues.some((i) => i.path[0] === "consent");
    return NextResponse.json({ error: consent ? "consent" : "invalid" }, { status: 400 });
  }
  const { side, nick, pronoun, tastes, asked } = parsed.data;
  const store = getStore();
  try {
    const r = await submitOrAsk();
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof SessionNotFound) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (e instanceof SideTaken) return NextResponse.json({ error: "taken" }, { status: 409 });
    console.error("live submit failed:", (e as Error).message);
    return NextResponse.json({ error: "busy" }, { status: 502 });
  }

  async function submitOrAsk() {
    const r = await submitSide(store, id, side, { nick: nick || (side === "a" ? "A" : "B"), pronoun, tastes, asked }, parseOne);
    if ("followUp" in r) return { followUp: r.followUp };
    if (r.both) {
      const s = await getStatus(store, id);
      if (shouldCompute(s)) await startCompute(id, s.lang);
    }
    return { ok: true, both: r.both };
  }
}
