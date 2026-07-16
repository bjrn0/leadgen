/**
 * One-off backfill: derive opportunities for every active entity that has
 * actionable insights but no (or stale) opportunities — e.g. entities crawled
 * before opportunity derivation existed, or leads just added to the watchlist.
 * Idempotent (the same anti-spam guard as a normal cycle) and ICP-aware, so it
 * produces exactly what the next cron run would. No crawl, no LLM beyond the ICP
 * fit score per newly-created opportunity.
 *
 *   npx tsx scripts/backfill-opportunities.ts
 */
import { nebius, supabase } from "../pipeline/clients.js";
import { config } from "../pipeline/config.js";
import { loadActiveIcp } from "../pipeline/icp.js";
import { deriveOpportunities } from "../pipeline/opportunities.js";

async function main() {
  const db = supabase();
  const icp = await loadActiveIcp(db);
  const icpOpts = { icp, icpClient: nebius(), model: config.nebius.model };
  console.log(icp ? `Using active ICP: ${icp.name}` : "No active ICP — hotness will be signal-only.");

  const { data: entities, error } = await db.from("entities").select("id, name").eq("status", "active");
  if (error) throw error;

  let totalCreated = 0;
  for (const e of entities ?? []) {
    const { created } = await deriveOpportunities(e.id, icpOpts);
    if (created.length > 0) {
      console.log(`  ${e.name}: +${created.length} opportunit${created.length === 1 ? "y" : "ies"} (top hotness ${Math.max(...created.map((o) => o.hotness))})`);
      totalCreated += created.length;
    }
  }
  console.log(`\nBackfill complete: ${totalCreated} opportunit${totalCreated === 1 ? "y" : "ies"} created.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
