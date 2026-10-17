export const instant = false;
import type { Metadata } from "next";
import Link from "next/link";

type P = { searchParams: Promise<Record<string, string>> };

export async function generateMetadata({ searchParams }: P): Promise<Metadata> {
  const s = await searchParams;
  const q = new URLSearchParams(s).toString();
  const title = s.l === "en" ? `${s.a} × ${s.b}: ${s.p}% taste-cheating in ${s.c || s.z}` : `${s.a} × ${s.b}: ${s.p}% de cachos en ${s.c || s.z}`;
  return { title, openGraph: { title, images: [`/api/card?${q}`] }, twitter: { card: "summary_large_image", images: [`/api/card?${q}`] } };
}

/** Public share page: shows the card and invites the visitor to try. */
export default async function SharePage({ searchParams }: P) {
  const s = await searchParams;
  const q = new URLSearchParams(s).toString();
  return (
    <main className="share-page">
      {/* eslint-disable-next-line @next/next/no-img-element -- dynamic OG image */}
      <img src={`/api/card?${q}`} alt="" />
      <Link className="cta" href="/">{s.l === "en" ? "Get yours →" : "Calcula los tuyos →"}</Link>
    </main>
  );
}
