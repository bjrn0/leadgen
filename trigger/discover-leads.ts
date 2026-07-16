import { schedules } from "@trigger.dev/sdk";
import { runDiscoveryCycle } from "../pipeline/cycles.js";

/**
 * Top-of-funnel discovery. Fires every 6h but only runs if the last discovery is
 * older than the user's configured discovery interval (Settings → cadence; default
 * 24h). Searches the open web from the active ICP, extracts fitting companies, and
 * proposes them as new leads (discovery_source='icp_search'). The user then adds
 * good ones to monitoring: discover → monitor → opportunities.
 * Same cycle body as the Vercel cron route /api/cron/discover.
 */
export const discoverLeadsTask = schedules.task({
  id: "discover-leads",
  cron: "0 */6 * * *",
  maxDuration: 1800,
  run: runDiscoveryCycle,
});
