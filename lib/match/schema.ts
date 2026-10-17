import { z } from "zod";

const nick = z.string().transform((s) => s.replace(/[<>]/g, "").trim().slice(0, 24));
/** Free text per person ("me gusta el gym y ver anime"); a list is joined for older clients. */
const tastes = z
  .union([z.string().max(500), z.array(z.string().max(80)).max(12).transform((xs) => xs.join(", "))])
  .transform((s) => s.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 500));

const pronoun = z.enum(["m", "f", "n"]).default("n");

/** Request body of POST /api/match. */
export const MatchRequest = z.object({
  consent: z.literal(true),
  lang: z.enum(["es", "en"]).default("es"),
  a: z.object({ nick, tastes, pronoun }),
  b: z.object({ nick, tastes, pronoun }),
  city: z.object({
    name: z.string().max(60).transform((s) => s.replace(/[<>]/g, "").trim() || "?"),
    country: z.string().max(60).optional(),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
});
export type MatchRequest = z.infer<typeof MatchRequest>;
