import { runMatch } from "../match/service";
import { parseTastes } from "../tastes/parse";
import type { Parse, Runner } from "./session";

/** Parses one person's text on submit (so the follow-up question can be asked on their own phone). */
export const parseOne: Parse = async (text) => {
  const r = await parseTastes(text, "");
  return { tastes: r.a, llm: r.llm };
};

/** Runs the normal pipeline with the two stored, already parsed inputs; streams steps into the session. */
export const liveRunner: Runner = ({ a, b, meta, lang, progress }) => {
  const steps: Parameters<typeof progress>[0] = [];
  return runMatch(
    { a: { nick: a.nick, tastes: a.tastes, pronoun: a.pronoun }, b: { nick: b.nick, tastes: b.tastes, pronoun: b.pronoun }, city: meta.city, lang },
    {
      ask: false,
      parsed: { a: a.parsed, b: b.parsed, llm: a.llm && b.llm },
      onStep: (s) => {
        const i = steps.findIndex((x) => x.id === s.id);
        if (i < 0) steps.push(s);
        else steps[i] = s;
        if (s.status !== "running") progress(steps);
      },
    },
  );
};
