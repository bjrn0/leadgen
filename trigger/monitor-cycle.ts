import { schedules } from "@trigger.dev/sdk/v3";
import { listEnabledEntities } from "../pipeline/store.js";
import { runEntityCycle } from "../pipeline/pipeline.js";

/**
 * Recurring production monitor. Iterates every enabled entity and runs the same
 * end-to-end cycle the local script runs. Web fetching is delegated to
 * Firecrawl / Browserbase (managed), satisfying Trigger.dev's no-direct-scrape policy.
 *
 * Default cron is hourly; per-entity cadence lives in entities.profile.cadence
 * and can later drive separate schedules if needed.
 */
export const monitorCycle = schedules.task({
  id: "monitor-cycle",
  cron: "0 * * * *",
  maxDuration: 3600,
  run: async () => {
    const entities = await listEnabledEntities();
    const results = [];
    for (const { input } of entities) {
      try {
        results.push(await runEntityCycle(input, "cron"));
      } catch (err) {
        results.push({ name: input.name, error: (err as Error).message });
      }
    }
    return { processed: results.length, results };
  },
});
