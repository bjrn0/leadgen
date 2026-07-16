import { schedules } from "@trigger.dev/sdk";
import { runMonitorCycle } from "../pipeline/cycles.js";

/**
 * Recurring production monitor. Fires hourly, but only re-crawls an entity if its
 * last successful run is older than the user's configured monitoring interval
 * (Settings tab → cadence; default 3h). This makes cadence data-driven without
 * redeploying the cron. Web fetching is delegated to Firecrawl / Browserbase.
 * Same cycle body as the Vercel cron route /api/cron/monitor.
 */
export const monitorCycle = schedules.task({
  id: "monitor-cycle",
  cron: "0 * * * *",
  maxDuration: 3600,
  run: runMonitorCycle,
});
