import { z } from "zod";

const nick = z.string().transform((s) => s.replace(/[<>]/g, "").trim().slice(0, 24));
const tastes = z.string().max(400).transform((s) =>
  s.split(/[,\n;]/).map((x) => x.replace(/[<>]/g, "").trim().slice(0, 60)).filter(Boolean),
);

/** Request body of POST /api/match. */
export const MatchRequest = z.object({
  consent: z.literal(true),
  lang: z.enum(["es", "en"]).default("es"),
  a: z.object({ nick, tastes }),
  b: z.object({ nick, tastes }),
  city: z.object({
    name: z.string().max(60).transform((s) => s.replace(/[<>]/g, "").trim() || "?"),
    country: z.string().max(60).optional(),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
});
export type MatchRequest = z.infer<typeof MatchRequest>;
