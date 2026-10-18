import { NextResponse } from "next/server";
import { LiveCreate } from "@/lib/match/schema";
import { getStore } from "@/lib/live/store";
import { createSession } from "@/lib/live/session";

/** POST /api/live: opens a live room for two phones. Returns its id and both join links. */
export async function POST(req: Request) {
  const parsed = LiveCreate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const meta = await createSession(getStore(), parsed.data.city, parsed.data.lang);
    const origin = new URL(req.url).origin;
    return NextResponse.json({ id: meta.id, a: `${origin}/live/${meta.id}?p=a`, b: `${origin}/live/${meta.id}?p=b` });
  } catch (e) {
    console.error("live create failed:", (e as Error).message);
    return NextResponse.json({ error: "busy" }, { status: 502 });
  }
}
