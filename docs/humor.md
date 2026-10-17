# Cacho-Map humor guide (v4)

Rules behind the roast prompt (`lib/agent/prompt.ts`), the judge and the sanitizer
(`lib/agent/roast.ts`, `lib/agent/sanitize.ts`).

## The premise

"Cacho" / "cachos" in Colombia means **being cheated on** ("le montaron los cachos",
"le pegaron cacho", "cachón/cachona"). It does **not** mean fighting.

Cacho-Map's joke: the **riesgo de cacho** is the share of the plans one person likes that the
other doesn't. Those are the plans where one ends up going out alone... or "with other
company". So every joke lives in that gap: the plan you'd do without your partner, the alibi,
the secret double life of your Saturday. It's about **plans and tastes**, never a real accusation.

## What we saw on X (Oct 2026)

A sample of posts using "montaron los cachos", "pegar cacho", "cachos con queso" and
"cachos de película" (Colombian and Venezuelan Spanish):

- Most real uses are **insults** thrown at a person ("por eso te montaron los cachos"), often
  in political fights. That's exactly the tone to avoid. Our jokes point at the plan or the
  taste, never at a person's worth.
- The posts people enjoy are **self-aware and specific**: the deer emoji 🦌, "me montaron los
  cachos, las cosas de ella duermen afuera". Small domestic consequences, not tragedy.
- Expressions only land when used with their real meaning. "Cachos de película" works when there
  are movies in the data; "cachos con queso" when there's food. Forced slang reads fake.

(Earlier v2 research on couple humor still applies: short setup → punchline, hyper-specific
cultural references, tiny stakes treated as huge drama, never punching down.)

## What a good joke looks like

**Setup** (a real taste or real place from Qloo) + **a double meaning** that connects it to
cheating / going out alone + **a short punchline**. It must make literal sense; if it needs an
explanation, it's out.

Hooks that work (what a taste is famous for, connected to cheating):

| Taste | Hook | Shape |
|---|---|---|
| Superheroes | secret identity, double life | "…ya tiene identidad secreta para los sábados." |
| Harry Potter | invisibility cloak, Marauder's Map | "…con capa de invisibilidad, ni el Mapa del Merodeador lo encuentra." |
| The Mentalist / Sherlock | catches liars | "…a Dani no le alcanza ninguna coartada." |
| Taylor Swift / Shakira | breakup songs / "las mujeres ya no lloran, facturan" | "…si hay cacho, mínimo sale un álbum." |
| Fast & Furious | "rápido" / "furioso" | "…uno sale rápido y el otro furioso." |
| Stranger Things | the Upside Down | "…no se sabe con quién anda en el Upside Down." |
| Food tags | "cachos con queso" | only when food is in the data |

Good (from v4 test runs):

- "A Dani le gusta Taylor Swift. Con este 90% de riesgo, si hay cacho, mínimo sale un álbum de canciones de despecho."
- "A Andrés le gusta Stranger Things; con este 55%, Laura no va a saber con quién anda en el 'Upside Down'."

Bad (rejected):

- ❌ "La mente no es tan fuerte para evitar un cacho." (no setup, makes no sense)
- ❌ "…se tira por la ventana." (dark: never)
- ❌ "Por eso le montaron los cachos." (an insult at a person, not a joke about plans)

## Rules (enforced by prompt, judge and sanitizer)

1. 1–2 sentences, ≤ 30 words, punchline at the end.
2. Name the couple and at least one real taste or real place from the Qloo tools.
3. Light and affectionate. Nothing explicit, cruel, dark or violent. No bodies, sexuality,
   religion, politics, named real third parties, or trashing a business.
4. No exclamation marks, emojis, "¡Ay,", morals or explaining the joke.
5. Only the overall % may appear.
6. Match the level: low risk → "the cacho would be with something harmless"; high → "each on their own".
7. Use the person's name when gender is unclear.

## Pipeline

1. The agent (gemini-2.5-flash) calls the Qloo tools and writes **3 candidates**, each with a different hook, guided by 3 rotating examples from the curated bank in `lib/agent/examples.ts` (examples about the couple's own tastes are excluded so it can't copy them).
2. The sanitizer cleans each one (banned phrases, other percentages, slang tics, and any sentence
   matching the dark/violent filter: ventana, muerte, matar, sangre, golpe, armas, kill, die…).
3. A judge (gemini-2.5-flash) answers pass/fail for: makes sense, real wordplay tied to a taste or
   place, punchline at the end, no contradiction, safe; rates funny 1-5 and force-ranks. Any fail or
   funny < 3 is rejected; if nothing passes, one regeneration; then the best-ranked sensible one.
4. Gender check: pronouns chosen in the form; "solo/sola" fixed per person, "sin compañía" for neutral.
5. If the LLM is unavailable, a data-driven template roast is used.
