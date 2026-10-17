/** Default LLM on the Vercel AI Gateway (the free tier only allows a few models). Override with AI_MODEL. */
export const DEFAULT_MODEL = "google/gemini-2.5-flash";
export const modelId = () => process.env.AI_MODEL || DEFAULT_MODEL;
