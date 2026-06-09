/**
 * End-to-end local runner. Mimics the dashboard: read a JSON file of people /
 * companies, run the full pipeline for each, and print a feedback summary.
 *
 *   npm run seed-and-run
 *   tsx scripts/seed-and-run.ts --file data/seed-entities.json --only person:tim-cook
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { SeedFileSchema } from "../pipeline/schemas.js";
import { runEntityCycle, type CycleResult } from "../pipeline/pipeline.js";
import { getEntityOutput, type EntityOutput } from "../pipeline/store.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

async function main() {
  const file = resolve(process.cwd(), arg("file") ?? "data/seed-entities.json");
  const only = arg("only");

  const raw = JSON.parse(await readFile(file, "utf8"));
  const seed = SeedFileSchema.parse(raw);
  const entities = only ? seed.entities.filter((e) => e.ingest_key === only) : seed.entities;

  if (entities.length === 0) {
    console.error(only ? `No entity with ingest_key "${only}"` : "Seed file has no entities");
    process.exit(1);
  }

  console.log(`\n▶ Running pipeline for ${entities.length} entit${entities.length === 1 ? "y" : "ies"} from ${file}\n`);

  const results: CycleResult[] = [];
  for (const entity of entities) {
    console.log(`── ${entity.type}: ${entity.name} (${entity.ingest_key})`);
    try {
      const result = await runEntityCycle(entity, "manual");
      results.push(result);
      printResult(result);
    } catch (err) {
      console.error(`  ✖ failed: ${(err as Error).message}\n`);
    }
  }

  printTotals(results);
  await writeOutput(results, only);
}

/** Dump the stored results (dashboard row + insights + findings) to a JSON file. */
async function writeOutput(results: CycleResult[], only?: string) {
  if (results.length === 0) return;
  const entities: EntityOutput[] = [];
  for (const r of results) entities.push(await getEntityOutput(r.entityId));

  const outPath = resolve(
    process.cwd(),
    arg("out") ?? `data/output/${only ? slug(only) : "all-entities"}.json`,
  );
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(
    outPath,
    JSON.stringify({ generated_at: new Date().toISOString(), entities }, null, 2),
    "utf8",
  );
  console.log(`\n📄 output written → ${outPath}`);
}

function printResult(r: CycleResult) {
  const s = r.stats;
  console.log(`  ${r.isNew ? "✚ new entity" : "• already stored"} — entity_id ${r.entityId}`);
  console.log(
    `  pages=${s.pagesFetched}  new=${s.newFindings}  changed=${s.changedFindings}  ` +
      `deduped=${s.deduped}  inferred=${s.inferred}  filtered=${s.filtered}  ` +
      `insights=${s.insightsCreated}  lowQ=${s.lowQuality}`,
  );
  if (r.sample) {
    console.log(`  sample → "${r.sample.headline}" (${r.sample.recency_label})`);
    console.log(`           ↳ ${r.sample.recommended_action}`);
  }
  console.log("");
}

function printTotals(results: CycleResult[]) {
  const sum = (k: keyof CycleResult["stats"]) => results.reduce((a, r) => a + r.stats[k], 0);
  console.log("════ totals ════");
  console.log(
    `entities=${results.length}  new=${results.filter((r) => r.isNew).length}  ` +
      `pages=${sum("pagesFetched")}  deduped=${sum("deduped")}  inferred=${sum("inferred")}  ` +
      `insights=${sum("insightsCreated")}  lowQ=${sum("lowQuality")}`,
  );
  console.log("\nInspect results:");
  console.log("  select * from insights order by created_at desc;");
  console.log("  select * from v_monitoring_accounts;\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
