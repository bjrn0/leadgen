import { nebius, supabase } from "./clients.js";
import { config } from "./config.js";
import { discoverLeads } from "./icp-discovery.js";
import { icpIsMeaningful, loadActiveIcp } from "./icp.js";
import { runEntityCycle } from "./pipeline.js";
import { applyStoredSettings, loadSettings, markDiscoveryRan } from "./settings.js";
import { lastSuccessfulRunAt, listEnabledEntities } from "./store.js";

/**
 * Scheduler-agnostic cycle bodies. Both schedulers call these — the trigger.dev
 * tasks (trigger/*.ts) and the Vercel cron routes (app/src/app/api/cron/*) — so
 * cadence throttling lives here, in data, not in whichever cron happens to fire.
 */

export async function runMonitorCycle() {
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
}

export async function runDiscoveryCycle() {
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
}
