import type { Lang } from "../types";

/** Numbers behind the % (see lib/scoring/score.ts), plus the taste names that explain them. */
export interface Calc {
  a: string; b: string; risk: number;
  totalA: number; onlyA: number; totalB: number; onlyB: number;
  /** "salsa ↔ bailar salsa, …": the shared taste pairs. */
  sharedTastes?: string;
  /** Tastes behind each person's solo plans. */
  whyA: string; whyB: string;
  tasteRisk?: number; placeRisk?: number;
  nA: number; nB: number; pairedA: number; pairedB: number;
  /** Did Qloo's tag affinity count (needs Qloo signals on both sides)? */
  tags: boolean;
  deep: number;
}
const pct = (n: number, d: number) => Math.round((n / Math.max(1, d)) * 100);
const plansEs = (c: Calc) =>
  `de los ${c.totalA} planes que Qloo le encuentra a ${c.a}, ${c.onlyA} no los compartiría ${c.b}${c.whyA ? ` (sobre todo por ${c.whyA})` : ""}; de los ${c.totalB} de ${c.b}, ${c.onlyB} no los compartiría ${c.a}${c.whyB ? ` (sobre todo por ${c.whyB})` : ""}. ${c.onlyA + c.onlyB ? "Esos son los planes que uno haría sin el otro… o con otra compañía." : "Todo lo harían juntos."}`;
const plansEn = (c: Calc) =>
  `of the ${c.totalA} plans Qloo finds for ${c.a}, ${c.onlyA} wouldn't be shared by ${c.b}${c.whyA ? ` (mostly because of ${c.whyA})` : ""}; of ${c.b}'s ${c.totalB}, ${c.onlyB} wouldn't be shared by ${c.a}${c.whyB ? ` (mostly because of ${c.whyB})` : ""}. ${c.onlyA + c.onlyB ? "Those are the plans one would do without the other… or with other company." : "You'd do it all together."}`;
const pctPlansEs = (c: Calc) => `${c.risk}% sale así: ${plansEs(c)}`;
const pctPlansEn = (c: Calc) => `Here's the ${c.risk}%: ${plansEn(c)}`;

const es = {
  heroTitle: ["¿Cuál es su riesgo de ", "cacho", "?"],
  tagline: "Un juego para parejas (con humor)",
  intro: "Si a uno le gustan planes que al otro no, ese uno termina saliendo solo... o con otra compañía. Escriban sus gustos y Qloo les dice qué tanto riesgo de cacho tienen y en qué zonas de su ciudad.",
  howItWorks: ["Cada uno escribe sus gustos", "Qloo busca los lugares de cada uno", "Ven su riesgo de cacho y el mapa"],
  personA: "Persona 1",
  personB: "Persona 2",
  nickA: "Nombre o apodo",
  nickB: "Nombre o apodo",
  pronounLabel: "Pronombre (opcional)",
  pronouns: { n: "elle", f: "ella", m: "él" },
  tastesA: "Ej: Me gustan las películas de acción, el gym, ver anime y Bad Bunny",
  tastesB: "Ej: Shakira, Friends, la playa, los k-dramas y la comida mexicana",
  tastesHint: "Escribe como hablas lo que le gusta a cada persona: artistas, series, películas, géneros, comida, planes (gym, playa, motos…). Nosotros lo separamos y se lo pasamos a Qloo.",
  suggest: "Ideas:",
  suggestionsA: ["Karol G", "Stranger Things", "FIFA", "Superhéroes", "Sushi", "Harry Potter"],
  suggestionsB: ["Shakira", "The Office", "Minecraft", "Anime", "Comida mexicana", "Taylor Swift"],
  example: "Llenar con un ejemplo",
  consent: "Los dos estamos de acuerdo en jugar. Solo nombres o apodos, sin datos de otras personas.",
  submit: "Comparar gustos",
  vs: "vs",
  where: "Ciudad",
  useLocation: "Usar mi ubicación",
  locating: "Buscándote…",
  locDenied: "Sin permiso de ubicación, escoge tu ciudad.",
  nearYou: "cerca de ti",
  cachos: "Riesgo de cacho",
  levels: { low: "Bajo: salen juntos casi siempre", medium: "Medio: ojo con los sábados", high: "Alto: cada uno por su lado", cheating: "Ya hay cacho (de planes)" },
  howCalcTitle: "¿Cómo se calcula?",
  howCalc: (c: Calc) => [
    `Cada gusto trae su propia lista de Qloo. Si lleva a un tipo de lugar (anime → cines, gym → gimnasios), Qloo ordena esos lugares para ese gusto; si no, usa los lugares que les gustan a sus fans. Mezclando las listas salen los ${c.totalA} lugares favoritos de ${c.a} en su ciudad y los ${c.totalB} de ${c.b}.`,
    ...(c.tasteRisk == null ? [] : [
      `Gustos: un gusto tiene pareja si el otro tiene el mismo o uno del mismo tipo (ceviche y comida de mar; salsa y bailar salsa). ${c.pairedA} de ${c.nA} gustos de ${c.a} y ${c.pairedB} de ${c.nB} de ${c.b} tienen pareja${c.tags ? "; la afinidad de gustos de Qloo pesa un 15%" : ""} → diferencia de gustos ${c.tasteRisk}%.`,
    ]),
    `Planes: un plan de uno cuenta como compartido si también está entre los ${c.deep} primeros de la lista del otro o sale de un gusto que comparten. De los de ${c.a}, ${c.onlyA} no lo son (${pct(c.onlyA, c.totalA)}%); de los de ${c.b}, ${c.onlyB} (${pct(c.onlyB, c.totalB)}%)${c.placeRisk == null ? "" : ` → planes por separado ${c.placeRisk}%`}.`,
    c.tasteRisk == null
      ? `Riesgo de cacho = el promedio de los dos = ${c.risk}%. 0–34% bajo, 35–59% medio, 60–79% alto, 80%+ ya hay cacho.`
      : `Riesgo de cacho = promedio de gustos (${c.tasteRisk}%) y planes (${c.placeRisk}%) = ${c.risk}%. 0–34% bajo, 35–59% medio, 60–79% alto, 80%+ ya hay cacho.`,
    `Los gustos repetidos de una misma persona (ceviche, mariscos) cuentan como uno, cada gusto pesa por separado (ninguno más del 40%) y quitamos los lugares que Qloo le recomienda a casi cualquiera en su ciudad.`,
  ],
  compat: "planes juntos",
  tagsStat: "afinidad de gustos (Qloo)",
  placesStat: "lugares que les gustan a los dos",
  zonesTitle: "Zonas de peligro y zonas seguras",
  zonesSub: "Peligro de cacho: barrios donde casi todo le gusta a uno solo. Seguras: donde irían los dos. Descripción hecha con datos de Qloo.",
  danger: "Peligro de cacho",
  safe: "Zona segura",
  zoneLine: (n: number, both: number) => `${n} ${n === 1 ? "lugar" : "lugares"} · a los dos les gustan ${both}`,
  planTitle: "Plan seguro (van juntos)",
  popFor: { both: "Les gusta a los dos", a: (w: string) => `Solo para ${w}`, b: (w: string) => `Solo para ${w}` },
  legendBoth: "Irían juntos",
  legendOnly: (who: string) => `Solo ${who}`,
  heat: "Rojo = zonas de peligro de cacho",
  share: "Compartir por WhatsApp",
  copy: "Copiar link",
  copied: "Copiado",
  again: "Probar otra vez",
  qlooSaw: "Lo que Qloo entendió",
  category: "categoría",
  agentFallback: "La IA estaba ocupada, este texto es de plantilla.",
  emptyMap: "Aquí aparecerán sus lugares. Verde: irían juntos. Rojo o azul: uno iría solo.",
  loading: [
    "Entendiendo sus gustos…",
    "Preguntándole a Qloo qué tienen en común…",
    "Buscando lugares en su ciudad…",
    "Revisando quién sale solo los sábados…",
    "Buscando coartadas en el mapa…",
    "Buscando el plan donde van juntos…",
    "Escribiendo el veredicto…",
  ],
  errors: {
    consent: "Los dos tienen que aceptar jugar.",
    invalid: "Revisa los datos e intenta otra vez.",
    no_tastes: "No reconocí esos gustos. Prueba con artistas, películas, series, juegos o comida.",
    busy: "Qloo está ocupado. Intenta en un momento.",
    network: "Se cayó la conexión. Intenta otra vez.",
  },
  footer: "Es un juego: el único cacho que medimos es de planes. Gustos y lugares por",
  langLabel: "EN",
  seeMap: "Ver el mapa ↓",
  city: "Ciudad",
  mapLabel: "Mapa",
  uiBits: "componentes de",
  docTitle: "Cacho-Map · ¿Cuál es su riesgo de cacho?",
  exampleA: "Me gusta Lana del Rey, el mentalista, películas de acción y las motos, el gym y ver anime",
  exampleB: "vallenato, fresas con crema, kdramas, la playa y BTS",
  entityTypes: { artist: "artista", movie: "película", tv_show: "serie", book: "libro", videogame: "videojuego", podcast: "pódcast", place: "lugar", brand: "marca o equipo", tag: "categoría", place_kind: "plan" } as Record<string, string>,
  tasteKinds: { title: "título", genre: "género", food: "comida", activity: "plan" } as Record<string, string>,
  viaPlaces: (kinds: string) => `busca ${kinds}`,
  viaGeneral: "lugares de sus fans",
  missingReason: {
    no_match: "Qloo no lo encontró",
    low_confidence: (got: string) => `Qloo solo encontró «${got}», no es lo mismo`,
    no_places: "no hay lugares de esto cerca en Qloo",
  },
  missingNote: "Tachado = no lo usamos para el cálculo (mejor no inventar).",
  placeWhyOne: (who: string, tastes: string) => `Por esto: le sale a ${who} por su gusto por ${tastes}.`,
  placeWhyBoth: (a: string, ta: string, b: string, tb: string) => `Les sale a los dos: a ${a} por ${ta} y a ${b} por ${tb}.`,
  fansOf: (x: string) => `${x} (lugares de sus fans según Qloo)`,
  zoneWhyOneSided: (zone: string, types: string, who: string, tw: string, other: string, to: string) =>
    `${zone}${types ? `: ${types}` : ""}. Aquí le salen planes por los gustos de ${who} (${tw}) y casi nada por los de ${other} (${to}) → ${who} iría sin ${other}.`,
  zoneWhySplit: (zone: string, types: string, a: string, ta: string, b: string, tb: string) =>
    `${zone}${types ? `: ${types}` : ""}. Aquí a ${a} le salen planes por ${ta} y a ${b} por ${tb}, pero casi ninguno en común → cada uno iría por su lado.`,
  zoneWhySafe: (zone: string, types: string, a: string, ta: string, b: string, tb: string) =>
    `${zone}${types ? `: ${types}` : ""}. Aquí les salen planes a los dos: a ${a} por ${ta} y a ${b} por ${tb} → irían juntos.`,
  placeWhyPair: (who: string, tw: string, other: string, to: string) => `Por esto: le sale a ${who} por ${tw}; a ${other} también le gusta ${to}, así que irían juntos.`,
  pctChain: (c: Calc) =>
    c.tasteRisk == null ? pctPlansEs(c) : `${c.risk}% = promedio de dos partes. Gustos (${c.tasteRisk}%): ${c.pairedA} de ${c.nA} gustos de ${c.a} y ${c.pairedB} de ${c.nB} de ${c.b} tienen pareja en los del otro${c.sharedTastes ? ` (${c.sharedTastes})` : ""}. Planes (${c.placeRisk}%): ${plansEs(c)}`,
  breakdownTitle: (who: string, total: number) => `De dónde salen los ${total} lugares de ${who}:`,
  breakdownLine: (taste: string, n: number, shared: number, how: string) =>
    n ? `${taste}: ${n} ${n === 1 ? "lugar" : "lugares"}${shared ? ` (${shared} en común)` : ""} · ${how}` : `${taste}: no le sumó lugares a su top · ${how}`,
  andWord: "y",
  sharedTaste: "en común",
};

type Dict = typeof es;

const en: Dict = {
  heroTitle: ["What's your ", "cheating", " risk?"],
  tagline: "A (playful) game for couples",
  intro: "If one of you likes plans the other doesn't, that one ends up going out alone... or with other company. Type your tastes and Qloo tells you your cheating risk, and where in your city.",
  howItWorks: ["Each of you types your tastes", "Qloo finds each one's places", "See your cheating risk and the map"],
  personA: "Person 1",
  personB: "Person 2",
  nickA: "Name or nickname",
  nickB: "Name or nickname",
  pronounLabel: "Pronoun (optional)",
  pronouns: { n: "they", f: "she", m: "he" },
  tastesA: "E.g. I like action movies, the gym, watching anime and Bad Bunny",
  tastesB: "E.g. Shakira, Friends, the beach, K-dramas and Mexican food",
  tastesHint: "Write what each person likes the way you'd say it: artists, shows, movies, genres, food, activities (gym, beach, motorcycles…). We split it up and pass it to Qloo.",
  suggest: "Ideas:",
  suggestionsA: ["Karol G", "Stranger Things", "FIFA", "Superheroes", "Sushi", "Harry Potter"],
  suggestionsB: ["Shakira", "The Office", "Minecraft", "Anime", "Mexican food", "Taylor Swift"],
  example: "Fill with an example",
  consent: "We both agree to play. Names or nicknames only, no data about other people.",
  submit: "Compare tastes",
  vs: "vs",
  where: "City",
  useLocation: "Use my location",
  locating: "Finding you…",
  locDenied: "No location permission, pick your city.",
  nearYou: "near you",
  cachos: "Cheating risk",
  levels: { low: "Low: you go out together", medium: "Medium: watch your Saturdays", high: "High: each on their own", cheating: "Already cheating (on plans)" },
  howCalcTitle: "How is it calculated?",
  howCalc: (c: Calc) => [
    `Each taste brings its own Qloo list. If it leads to a kind of place (anime → movie theaters, gym → gyms), Qloo ranks those places for that taste; otherwise it uses the places its fans like. Blending the lists gives ${c.a}'s ${c.totalA} favorite places in your city and ${c.b}'s ${c.totalB}.`,
    ...(c.tasteRisk == null ? [] : [
      `Tastes: a taste has a match if the other has the same one or one of the same kind (ceviche and seafood; salsa and salsa dancing). ${c.pairedA} of ${c.a}'s ${c.nA} tastes and ${c.pairedB} of ${c.b}'s ${c.nB} have a match${c.tags ? "; Qloo's taste affinity weighs 15%" : ""} → taste difference ${c.tasteRisk}%.`,
    ]),
    `Plans: a plan counts as shared if it's also in the top ${c.deep} of the other's list or comes from a taste you share. Of ${c.a}'s, ${c.onlyA} aren't (${pct(c.onlyA, c.totalA)}%); of ${c.b}'s, ${c.onlyB} (${pct(c.onlyB, c.totalB)}%)${c.placeRisk == null ? "" : ` → separate plans ${c.placeRisk}%`}.`,
    c.tasteRisk == null
      ? `Cheating risk = the average of both = ${c.risk}%. 0–34% low, 35–59% medium, 60–79% high, 80%+ already cheating.`
      : `Cheating risk = average of tastes (${c.tasteRisk}%) and plans (${c.placeRisk}%) = ${c.risk}%. 0–34% low, 35–59% medium, 60–79% high, 80%+ already cheating.`,
    `Repeated tastes of one person (ceviche, shellfish) count as one, each taste counts separately (none above 40%), and we drop places Qloo recommends to almost anyone in your city.`,
  ],
  compat: "plans together",
  tagsStat: "taste affinity (Qloo)",
  placesStat: "places you both like",
  zonesTitle: "Danger zones and safe zones",
  zonesSub: "Cheating danger: areas where almost everything suits only one of you. Safe: where you'd both go. Descriptions built from Qloo data.",
  danger: "Cheating danger",
  safe: "Safe zone",
  zoneLine: (n: number, both: number) => `${n} ${n === 1 ? "place" : "places"} · ${both} you both like`,
  planTitle: "Safe plan (go together)",
  popFor: { both: "You both like it", a: (w: string) => `Only for ${w}`, b: (w: string) => `Only for ${w}` },
  legendBoth: "You'd go together",
  legendOnly: (who: string) => `Only ${who}`,
  heat: "Red marks the cheating danger zones",
  share: "Share on WhatsApp",
  copy: "Copy link",
  copied: "Copied",
  again: "Try again",
  qlooSaw: "What Qloo understood",
  category: "category",
  agentFallback: "The AI was busy, this text is a template.",
  emptyMap: "Your places will show up here. Green: you'd go together. Red or blue: one goes alone.",
  loading: [
    "Understanding your tastes…",
    "Asking Qloo what you have in common…",
    "Finding places in your city…",
    "Checking who goes out alone on Saturdays…",
    "Looking for alibis on the map…",
    "Finding the plan you'd do together…",
    "Writing the verdict…",
  ],
  errors: {
    consent: "You both need to agree to play.",
    invalid: "Check the form and try again.",
    no_tastes: "Couldn't recognize those. Try artists, movies, shows, games or food.",
    busy: "Qloo is busy. Try again in a moment.",
    network: "Connection dropped. Try again.",
  },
  footer: "It's a game: the only cheating we measure is on plans. Taste and places by",
  langLabel: "ES",
  seeMap: "See the map ↓",
  city: "City",
  mapLabel: "Map",
  uiBits: "UI bits from",
  docTitle: "Cacho-Map · What's your cheating risk?",
  exampleA: "I like Lana Del Rey, The Mentalist, action movies and motorcycles, the gym and watching anime",
  exampleB: "vallenato, strawberries and cream, K-dramas, the beach and BTS",
  entityTypes: { artist: "artist", movie: "movie", tv_show: "TV show", book: "book", videogame: "video game", podcast: "podcast", place: "place", brand: "brand or team", tag: "category", place_kind: "activity" } as Record<string, string>,
  tasteKinds: { title: "title", genre: "genre", food: "food", activity: "activity" } as Record<string, string>,
  viaPlaces: (kinds: string) => `looks for ${kinds}`,
  viaGeneral: "places its fans like",
  missingReason: {
    no_match: "Qloo didn't find it",
    low_confidence: (got: string) => `Qloo only found “${got}”, not the same thing`,
    no_places: "no places for this nearby on Qloo",
  },
  missingNote: "Crossed out = not used in the score (better than making things up).",
  placeWhyOne: (who: string, tastes: string) => `Why: Qloo picks it for ${who} because of ${tastes}.`,
  placeWhyBoth: (a: string, ta: string, b: string, tb: string) => `You both get it: ${a} because of ${ta}, ${b} because of ${tb}.`,
  fansOf: (x: string) => `${x} (places its fans like, per Qloo)`,
  zoneWhyOneSided: (zone: string, types: string, who: string, tw: string, other: string, to: string) =>
    `${zone}${types ? `: ${types}` : ""}. Here ${who}'s tastes (${tw}) bring up plans and ${other}'s (${to}) almost none → ${who} would go without ${other}.`,
  zoneWhySplit: (zone: string, types: string, a: string, ta: string, b: string, tb: string) =>
    `${zone}${types ? `: ${types}` : ""}. Here ${a} gets plans from ${ta} and ${b} from ${tb}, but almost none in common → each would go on their own.`,
  zoneWhySafe: (zone: string, types: string, a: string, ta: string, b: string, tb: string) =>
    `${zone}${types ? `: ${types}` : ""}. Here you both get plans: ${a} from ${ta}, ${b} from ${tb} → you'd go together.`,
  placeWhyPair: (who: string, tw: string, other: string, to: string) => `Why: Qloo picks it for ${who} because of ${tw}; ${other} likes ${to} too, so you'd go together.`,
  pctChain: (c: Calc) =>
    c.tasteRisk == null ? pctPlansEn(c) : `${c.risk}% = the average of two parts. Tastes (${c.tasteRisk}%): ${c.pairedA} of ${c.a}'s ${c.nA} tastes and ${c.pairedB} of ${c.b}'s ${c.nB} have a match in the other's${c.sharedTastes ? ` (${c.sharedTastes})` : ""}. Plans (${c.placeRisk}%): ${plansEn(c)}`,
  breakdownTitle: (who: string, total: number) => `Where ${who}'s ${total} places come from:`,
  breakdownLine: (taste: string, n: number, shared: number, how: string) =>
    n ? `${taste}: ${n} ${n === 1 ? "place" : "places"}${shared ? ` (${shared} shared)` : ""} · ${how}` : `${taste}: added no places to the top · ${how}`,
  andWord: "and",
  sharedTaste: "shared",
};

export const dictionaries: Record<Lang, Dict> = { es, en };
export type { Dict };
export type ErrorCode = keyof Dict["errors"];
