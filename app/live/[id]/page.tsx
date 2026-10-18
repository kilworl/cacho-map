export const instant = false;
import type { Metadata } from "next";
import { LiveSession } from "@/components/LiveSession";
import { getStore } from "@/lib/live/store";
import { getStatus, isSessionId, type Side } from "@/lib/live/session";
import { cardQuery } from "@/lib/card/params";

type P = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> };

/** Once revealed, a shared room link previews like a result card (Open Graph / X). */
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { id } = await params;
  const base: Metadata = { title: "Cacho-Map · Pareja en vivo / Live couple", robots: { index: false } };
  if (!isSessionId(id)) return base;
  try {
    const s = await getStatus(getStore(), id);
    const r = s.result;
    if (!r) return base;
    const title = r.lang === "en" ? `${r.a} × ${r.b}: ${r.risk}% cheating risk in ${r.city.name}` : `${r.a} × ${r.b}: riesgo de cacho ${r.risk}% en ${r.city.name}`;
    const img = `/api/card?f=og&${cardQuery(r)}`;
    return { ...base, title, openGraph: { title, images: [{ url: img, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", title, images: [img] } };
  } catch {
    return base;
  }
}

export default async function LivePage({ params, searchParams }: P) {
  const { id } = await params;
  const { p } = await searchParams;
  return <LiveSession id={id} side={p === "a" || p === "b" ? (p as Side) : undefined} />;
}
