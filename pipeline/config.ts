import { config as loadEnv } from "dotenv";

/**
 * Central config + defaults for the pipeline. Reads from process.env once.
 * Tuning knobs have sensible defaults so the script runs without extra setup.
 *
 * Loads .env.local first (your real secrets, gitignored), then .env as a
 * fallback. Existing process.env values always win.
 */
loadEnv({ path: ".env.local" });
loadEnv(); // .env

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  supabase: {
    // Accept both the legacy names and the new Supabase naming used in .env.local
    // (NEXT_PUBLIC_SUPABASE_URL + DATABASE_SECRET_KEY is the sb_secret_… service-role key).
    url: () => process.env.SUPABASE_URL || req("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: () => process.env.SUPABASE_SERVICE_ROLE_KEY || req("DATABASE_SECRET_KEY"),
  },
  nebius: {
    apiKey: () => req("NEBIUS_API_KEY"),
    baseUrl: process.env.NEBIUS_BASE_URL || "https://api.studio.nebius.com/v1",
    model: process.env.NEBIUS_MODEL || "Qwen/Qwen3-30B-A3B-Instruct-2507",
    embeddingModel: process.env.NEBIUS_EMBEDDING_MODEL || "Qwen/Qwen3-Embedding-8B",
  },
  firecrawl: {
    apiKey: () => req("FIRECRAWL_API_KEY"),
  },
  browserbase: {
    apiKey: process.env.BROWSERBASE_API_KEY || "",
    projectId: process.env.BROWSERBASE_PROJECT_ID || "",
    enabled: Boolean(process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID),
  },
  // `tuning` and `engines` hold env defaults; the Settings tab overlays DB values
  // onto them each run via applyStoredSettings() (pipeline/settings.ts), so these
  // are intentionally MUTABLE (no `as const`).
  tuning: {
    recencyWindowDays: num("RECENCY_WINDOW_DAYS", 45),
    dedupSimilarityThreshold: num("DEDUP_SIMILARITY_THRESHOLD", 0.92),
    minClassifyScore: num("MIN_CLASSIFY_SCORE", 0.4),
    minInsightConfidence: num("MIN_INSIGHT_CONFIDENCE", 0.55),
    searchResultsPerQuery: num("SEARCH_RESULTS_PER_QUERY", 5),
    maxCharsPerChunk: num("MAX_CHARS_PER_CHUNK", 12000),
    // Skip creating a second 'new' opportunity for the same (entity, signal_type)
    // within this many days — catches "same event, different article".
    opportunityDedupDays: num("OPPORTUNITY_DEDUP_DAYS", 7),
    // Drafts need some variation so Regenerate produces a different email.
    draftTemperature: num("DRAFT_TEMPERATURE", 0.4),
    // ICP-fit floor for auto-discovered leads.
    minLeadFit: num("MIN_LEAD_FIT", 40),
  },
  engines: {
    // Browserbase fallback for JS-heavy pages. Requires the env keys AND the
    // Settings toggle; env presence is the default.
    browserbaseFallback: Boolean(process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID),
  },
};
