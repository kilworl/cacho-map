import { NextResponse } from "next/server";
import { MatchRequest } from "@/lib/match/schema";
import { matchOutcome, type MatchEvent } from "@/lib/match/run";

export const maxDuration = 60;

/**
 * POST /api/match: thin HTTP adapter over lib/match. With `?stream=1` the answer is
 * NDJSON: one {"type":"step"} line per agent step as it happens, then one final
 * "result" | "question" | "error" line. Without it, just the final JSON.
 */
export async function POST(req: Request) {
  const parsed = MatchRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const consent = parsed.error.issues.some((i) => i.path[0] === "consent");
    return NextResponse.json({ error: consent ? "consent" : "invalid" }, { status: 400 });
  }
  if (new URL(req.url).searchParams.get("stream") !== "1") {
    const out = await matchOutcome(parsed.data);
    if (out.type === "result") return NextResponse.json(out.result);
    if (out.type === "question") return NextResponse.json({ followUp: out.followUp, trace: out.trace });
    return NextResponse.json({ error: out.error, ...(out.missing && { missing: out.missing }) }, { status: out.error === "no_tastes" ? 422 : 502 });
  }
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const send = (ev: MatchEvent) => ctrl.enqueue(enc.encode(`${JSON.stringify(ev)}\n`));
      const final = await matchOutcome(parsed.data, { onStep: (step) => send({ type: "step", step }) });
      send(final);
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
