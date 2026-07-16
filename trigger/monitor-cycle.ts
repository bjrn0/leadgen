import { schedules } from "@trigger.dev/sdk";
import { supabase } from "../pipeline/clients.js";
import { lastSuccessfulRunAt, listEnabledEntities } from "../pipeline/store.js";
import { loadSettings } from "../pipeline/settings.js";
import { runEntityCycle } from "../pipeline/pipeline.js";

/**
 * Recurring production monitor. Fires hourly, but only re-crawls an entity if its
 * last successful run is older than the user's configured monitoring interval
 * (Settings tab → cadence; default 3h). This makes cadence data-driven without
 * redeploying the cron. Web fetching is delegated to Firecrawl / Browserbase.
 */
export const monitorCycle = schedules.task({
  id: "monitor-cycle",
  cron: "0 * * * *",
  maxDuration: 3600,
  run: async () => {
    const settings = await loadSettings(supabase());
    const intervalMs = (settings?.monitoring_interval_hours ?? 3) * 3_600_000;
    const now = Date.now();

    const entities = await listEnabledEntities();
    const results = [];
    let skipped = 0;
    for (const { id, input } of entities) {
      const last = await lastSuccessfulRunAt(id);
      if (last && now - new Date(last).getTime() < intervalMs) {
        skipped++;
        continue;
      }
      try {
        results.push(await runEntityCycle(input, "cron"));
      } catch (err) {
        results.push({ name: input.name, error: (err as Error).message });
      }
    }
    return { processed: results.length, skipped, results };
  },
});
