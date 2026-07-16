import { schedules } from "@trigger.dev/sdk";
import { nebius, supabase } from "../pipeline/clients.js";
import { config } from "../pipeline/config.js";
import { discoverLeads } from "../pipeline/icp-discovery.js";
import { icpIsMeaningful, loadActiveIcp } from "../pipeline/icp.js";
import { applyStoredSettings, markDiscoveryRan } from "../pipeline/settings.js";

/**
 * Top-of-funnel discovery. Fires every 6h but only runs if the last discovery is
 * older than the user's configured discovery interval (Settings → cadence; default
 * 24h). Searches the open web from the active ICP, extracts fitting companies, and
 * proposes them as new leads (discovery_source='icp_search'). The user then adds
 * good ones to monitoring: discover → monitor → opportunities.
 */
export const discoverLeadsTask = schedules.task({
  id: "discover-leads",
  cron: "0 */6 * * *",
  maxDuration: 1800,
  run: async () => {
    const db = supabase();
    const settings = await applyStoredSettings(db);
    const intervalMs = (settings?.discovery_interval_hours ?? 24) * 3_600_000;
    const last = settings?.last_discovery_at ? new Date(settings.last_discovery_at).getTime() : 0;
    if (last && Date.now() - last < intervalMs) {
      return { skipped: "within discovery interval" };
    }

    const icp = await loadActiveIcp(db);
    if (!icpIsMeaningful(icp)) {
      return { skipped: "no active ICP" };
    }
    const result = await discoverLeads({ icp: icp!, client: nebius(), model: config.nebius.model });
    await markDiscoveryRan(db);
    return result;
  },
});
