export const instant = false;
import type { Metadata } from "next";
type P = { searchParams: Promise<Record<string, string>> };
export async function generateMetadata({ searchParams }: P): Promise<Metadata> {
  const s = await searchParams; const q = new URLSearchParams(s).toString();
  const title = `${s.a} ❤️ ${s.b}: ${s.p}% de cachos en ${s.z}`;
  return { title, openGraph: { title, images: [`/api/card?${q}`] }, twitter: { card: "summary_large_image", images: [`/api/card?${q}`] } };
}
export default async function R({ searchParams }: P) {
  const q = new URLSearchParams(await searchParams).toString();
  return <main><img src={`/api/card?${q}`} alt="" style={{ width: "100%", borderRadius: 16 }} /><a className="btn" href="/">Calcula los tuyos 🦌</a></main>;
}
