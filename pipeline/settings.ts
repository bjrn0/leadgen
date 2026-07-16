import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";

/**
 * Runtime settings — the singleton `settings` row the user edits in the Settings
 * tab. loadSettings() reads it; applyStoredSettings() overlays it onto the mutable
 * config.tuning/config.engines so every downstream `config.tuning.X` read picks up
 * the user's values without threading options through every function. Env defaults
 * (config.ts) apply when a column is null/missing.
 */

export interface SettingsRow {
  id: number;
  monitoring_interval_hours: number;
  discovery_interval_hours: number;
  last_discovery_at: string | null;
  browserbase_fallback: boolean;
  search_results_per_query: number;
  min_lead_fit: number;
  min_insight_confidence: number;
  dedup_similarity_threshold: number;
  min_classify_score: number;
  updated_at: string;
}

export async function loadSettings(db: SupabaseClient): Promise<SettingsRow | null> {
  const { data, error } = await db.from("settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return (data as SettingsRow) ?? null;
}

/** Fetch settings and overlay them onto the mutable config. Call once per run. */
export async function applyStoredSettings(db: SupabaseClient): Promise<SettingsRow | null> {
  const s = await loadSettings(db);
  if (!s) return null;
  config.tuning.searchResultsPerQuery = s.search_results_per_query;
  config.tuning.minLeadFit = s.min_lead_fit;
  config.tuning.minInsightConfidence = Number(s.min_insight_confidence);
  config.tuning.dedupSimilarityThreshold = Number(s.dedup_similarity_threshold);
  config.tuning.minClassifyScore = Number(s.min_classify_score);
  // Browserbase needs BOTH the env keys and the toggle.
  config.engines.browserbaseFallback = config.browserbase.enabled && s.browserbase_fallback;
  return s;
}

/** Record that ICP discovery just ran (for cadence gating in the cron). */
export async function markDiscoveryRan(db: SupabaseClient): Promise<void> {
  await db.from("settings").update({ last_discovery_at: new Date().toISOString() }).eq("id", 1);
}
