/**
 * Read-only export of what's currently stored. No crawl, no LLM, no API spend.
 * Dumps each entity's dashboard-shaped result (monitoring row + graded insights +
 * crawled findings) to a JSON file.
 *
 *   npm run export-findings
 *   tsx scripts/export-findings.ts --only person:tim-cook
 *   tsx scripts/export-findings.ts --out data/output/custom.json
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { supabase } from "../pipeline/clients.js";
import { getEntityOutput, type EntityOutput } from "../pipeline/store.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

async function main() {
  const only = arg("only");

  let query = supabase().from("entities").select("id, ingest_key").order("created_at");
  if (only) query = query.eq("ingest_key", only);
  const { data: rows, error } = await query;
  if (error) throw error;
  if (!rows || rows.length === 0) {
    console.error(only ? `No entity with ingest_key "${only}"` : "No entities stored yet — run the pipeline first.");
    process.exit(1);
  }

  const entities: EntityOutput[] = [];
  for (const row of rows) entities.push(await getEntityOutput(row.id));

  const outPath = resolve(
    process.cwd(),
    arg("out") ?? `data/output/${only ? slug(only) : "all-entities"}.json`,
  );
  await mkdir(dirname(outPath), { recursive: true });

  const payload = { generated_at: new Date().toISOString(), entities };
  await writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");

  const totalInsights = entities.reduce((a, e) => a + e.insights.length, 0);
  console.log(`✓ wrote ${outPath}`);
  console.log(`  ${entities.length} entit${entities.length === 1 ? "y" : "ies"}, ${totalInsights} insight(s) total`);
  for (const e of entities) {
    const ok = e.insights.filter((i) => i.quality === "ok").length;
    console.log(`  • ${e.name} (${e.ingest_key}): ${ok} ok / ${e.insights.length} total, ${e.findings.length} findings`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
