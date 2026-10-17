/** Default LLM on the Vercel AI Gateway (the free tier only allows a few models). Override with AI_MODEL. */
export const DEFAULT_MODEL = "google/gemini-2.5-flash";
export const modelId = () => process.env.AI_MODEL || DEFAULT_MODEL;
/** Small, fast model for the taste-normalization step (separate quota from the roast model). */
export const NORMALIZE_MODEL = "google/gemini-2.5-flash-lite";
export const normalizeModelId = () => process.env.NORMALIZE_MODEL || NORMALIZE_MODEL;
/** Judge for roast candidates: the strongest model the free tier allows (2.5 Pro / 3.x are refused). */
export const JUDGE_MODEL = "google/gemini-2.5-flash";
export const judgeModelId = () => process.env.JUDGE_MODEL || JUDGE_MODEL;
