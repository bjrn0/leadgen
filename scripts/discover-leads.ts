/**
 * Manual ICP lead-discovery runner — search the open web from the active ICP and
 * propose fitting companies as new leads. Firecrawl-spending (like the crawl stage).
 *
 *   npx tsx scripts/discover-leads.ts [--max-queries N] [--results N] [--min-fit N] [--dry-run]
 *
 * --dry-run prints the queries + matches + fit scores without writing.
 */
import { nebius, supabase } from "../pipeline/clients.js";
import { config } from "../pipeline/config.js";
import { buildIcpQueries, discoverLeads } from "../pipeline/icp-discovery.js";
import { icpIsMeaningful, loadActiveIcp } from "../pipeline/icp.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const icp = await loadActiveIcp(supabase());
  if (!icpIsMeaningful(icp)) {
    console.error("No meaningful active ICP — set one via the ICP panel (or PUT /api/icp) first.");
    process.exit(1);
  }
  const maxQueries = Number(arg("max-queries") ?? 5);
  const queries = buildIcpQueries(icp!, maxQueries);
  console.log(`\n▶ ICP discovery for "${icp!.name}"`);
  console.log(`  queries:\n${queries.map((q) => `    · ${q}`).join("\n")}\n`);

  if (flag("dry-run")) {
    console.log("dry-run: showing queries only (no Firecrawl / LLM spend).");
    return;
  }

  const res = await discoverLeads({
    icp: icp!,
    client: nebius(),
    model: config.nebius.model,
    maxQueries,
    resultsPerQuery: Number(arg("results") ?? 4),
    minFit: Number(arg("min-fit") ?? 40),
  });

  console.log(`\n════ result ════`);
  console.log(`  pages searched: ${res.pagesSearched}`);
  console.log(`  proposed:       ${res.proposed}`);
  console.log(`  skipped (already tracked): ${res.skippedExisting}`);
  console.log(`  skipped (below min fit):   ${res.skippedLowFit}`);
  console.log(`\nInspect: select name, type, icp_fit, hotness, left(icp_fit_reason,80) from lead_candidates where discovery_source='icp_search' order by hotness desc;`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
