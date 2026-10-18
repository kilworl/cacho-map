import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CARD_SIZES, isCardFormat, parseCard } from "@/lib/card/params";
import { Card } from "@/lib/card/layout";

// Bricolage Grotesque (SIL OFL), static weights for Satori.
const fonts = Promise.all(
  [500, 800].map(async (weight) => ({
    name: "Bricolage",
    data: await readFile(join(process.cwd(), `assets/fonts/Bricolage-${weight}.ttf`)),
    weight: weight as 500 | 800,
    style: "normal" as const,
  })),
);

/**
 * GET /api/card?f=story|post|og&…  Share card as PNG: Instagram story (1080x1920),
 * feed post (1080x1350, default) or X / Open Graph (1200x630). Params: lib/card/params.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const f = isCardFormat(q.get("f")) ? (q.get("f") as keyof typeof CARD_SIZES) : "post";
  const d = parseCard(q);
  const res = new ImageResponse(<Card d={d} f={f} />, { ...CARD_SIZES[f], fonts: await fonts });
  if (q.get("dl")) res.headers.set("content-disposition", `attachment; filename="cacho-map-${d.pct}-${f}.png"`);
  res.headers.set("cache-control", "public, max-age=86400, immutable");
  return res;
}
