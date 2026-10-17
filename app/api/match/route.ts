import { NextResponse } from "next/server";
import { MatchRequest } from "@/lib/match/schema";
import { NoTastesError, runMatch } from "@/lib/match/service";

export const maxDuration = 60;

/** POST /api/match: thin HTTP adapter over lib/match/service. Errors are codes the UI translates. */
export async function POST(req: Request) {
  const parsed = MatchRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const consent = parsed.error.issues.some((i) => i.path[0] === "consent");
    return NextResponse.json({ error: consent ? "consent" : "invalid" }, { status: 400 });
  }
  const { a, b, city, lang } = parsed.data;
  try {
    const result = await runMatch({ a: { nick: a.nick || "A", tastes: a.tastes, pronoun: a.pronoun }, b: { nick: b.nick || "B", tastes: b.tastes, pronoun: b.pronoun }, city, lang });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof NoTastesError) return NextResponse.json({ error: "no_tastes", missing: e.missing }, { status: 422 });
    console.error("match failed:", (e as Error).message);
    return NextResponse.json({ error: "busy" }, { status: 502 });
  }
}
