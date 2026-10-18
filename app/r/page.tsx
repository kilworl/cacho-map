export const instant = false;
import type { Metadata } from "next";
import Link from "next/link";

type P = { searchParams: Promise<Record<string, string>> };

const clean = (s: Record<string, string>) => {
  const q = new URLSearchParams(s);
  q.delete("f");
  q.delete("dl");
  return q.toString();
};

export async function generateMetadata({ searchParams }: P): Promise<Metadata> {
  const s = await searchParams;
  const q = clean(s);
  const title = s.l === "en" ? `${s.a} × ${s.b}: ${s.p}% cheating risk in ${s.c || s.z}` : `${s.a} × ${s.b}: riesgo de cacho ${s.p}% en ${s.c || s.z}`;
  const og = `/api/card?f=og&${q}`;
  return {
    title,
    description: s.t,
    openGraph: { title, description: s.t, images: [{ url: og, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description: s.t, images: [og] },
  };
}

/** Public share page: shows the card and invites the visitor to try. */
export default async function SharePage({ searchParams }: P) {
  const s = await searchParams;
  const q = clean(s);
  return (
    <main className="share-page">
      {/* eslint-disable-next-line @next/next/no-img-element -- dynamic OG image */}
      <img src={`/api/card?f=post&${q}`} alt="" />
      <Link className="cta" href="/">{s.l === "en" ? "Get yours →" : "Calcula los tuyos →"}</Link>
    </main>
  );
}
