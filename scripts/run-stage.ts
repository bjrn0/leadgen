/**
 * Stage-wise pipeline runner — run and inspect each stage standalone so you can
 * verifiably assess what it generates before (or without) storing it.
 *
 *   tsx scripts/run-stage.ts <stage> --only <ingest_key> [options]
 *
 *   stages:
 *     crawl          collectPages for the entity; print each page; store findings
 *                    unless --dry-run. THE ONLY STAGE THAT SPENDS FIRECRAWL QUOTA.
 *     classify       re-run the classify LLM pass over stored findings; print verdicts.
 *                    Never writes.
 *     extract        classify -> extract -> grade over stored findings; print insights,
 *                    quality reasons, and discovered lead candidates; writes unless --dry-run.
 *     opportunities  derive scored opportunities from ok-insights; print score breakdowns
 *                    and skip reasons; writes unless --dry-run.
 *     draft          generate an outreach email for the top-scored 'new' opportunity
 *                    (or --opportunity <uuid>); print subject/body/grounding; writes
 *                    unless --dry-run.
 *     all            full runEntityCycle (crawl -> ... -> opportunities) + summary.
 *
 *   options:
 *     --only <ingest_key>    e.g. person:tim-cook (required for every stage)
 *     --file <path>          seed JSON for crawl/all when the entity isn't in the DB yet
 *     --url <substring>      limit classify/extract to findings whose URL matches
 *     --limit <n>            max findings to process (default 5)
 *     --dry-run              print what would be stored, write nothing
 *     --opportunity <uuid>   draft: target a specific opportunity
 *
 *   examples:
 *     npm run run-stage -- extract --only person:tim-cook --limit 2 --dry-run
 *     npm run run-stage -- opportunities --only company:nvidia
 *     npm run run-stage -- draft --only person:tim-cook --dry-run
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { nebius, supabase } from "../pipeline/clients.js";
import { config } from "../pipeline/config.js";
import { collectPages, type CrawledPage } from "../pipeline/crawl.js";
import { filterMentions, upsertCandidates } from "../pipeline/discovery.js";
import { classify, extract } from "../pipeline/extract.js";
import { deriveOpportunities } from "../pipeline/opportunities.js";
import { generateDraft } from "../pipeline/outreach.js";
import { runEntityCycle } from "../pipeline/pipeline.js";
import { gradeInsight } from "../pipeline/quality.js";
import { SeedFileSchema, type EntityInput } from "../pipeline/schemas.js";
import {
  insertInsights,
  listFindings,
  loadEntityByIngestKey,
  processFinding,
  upsertEntity,
  type StoredFinding,
} from "../pipeline/store.js";

const STAGES = ["crawl", "classify", "extract", "opportunities", "draft", "all"] as const;
type Stage = (typeof STAGES)[number];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

const hr = (label: string) => console.log(`\n════ ${label} ${"═".repeat(Math.max(0, 60 - label.length))}`);

async function loadEntity(ingestKey: string): Promise<{ id: string | null; input: EntityInput }> {
  // DB first (the normal case for post-crawl stages), seed file as fallback for
  // crawling an entity that was never stored.
  const row = await loadEntityByIngestKey(ingestKey);
  if (row) return { id: row.id, input: row.input };

  const file = resolve(process.cwd(), arg("file") ?? "data/seed-entities.json");
  const seed = SeedFileSchema.parse(JSON.parse(await readFile(file, "utf8")));
  const input = seed.entities.find((e) => e.ingest_key === ingestKey);
  if (!input) {
    console.error(`Entity "${ingestKey}" found neither in DB nor in ${file}`);
    process.exit(1);
  }
  return { id: null, input };
}

function requireEntityId(id: string | null, ingestKey: string): string {
  if (!id) {
    console.error(`Entity "${ingestKey}" is not stored yet — run the crawl stage (without --dry-run) first.`);
    process.exit(1);
  }
  return id;
}

/** Reconstruct the CrawledPage shape from a stored finding for LLM re-runs. */
function findingToPage(f: StoredFinding): CrawledPage {
  return {
    url: f.canonical_url,
    title: f.title,
    markdown: f.raw_markdown ?? "",
    publishedAt: f.published_at,
    via: "firecrawl_scrape",
  };
}

async function loadPages(entityId: string): Promise<{ finding: StoredFinding; page: CrawledPage }[]> {
  const findings = await listFindings(entityId, {
    limit: Number(arg("limit") ?? 5),
    url: arg("url"),
  });
  const usable = findings.filter((f) => (f.raw_markdown ?? "").length > 0);
  if (usable.length === 0) {
    console.error("No stored findings with content — run the crawl stage first.");
    process.exit(1);
  }
  return usable.map((finding) => ({ finding, page: findingToPage(finding) }));
}

// ---------------------------------------------------------------------------
// stages
// ---------------------------------------------------------------------------

async function stageCrawl(input: EntityInput, dryRun: boolean) {
  hr(`crawl — ${input.name}${dryRun ? " (dry-run)" : ""}`);
  const pages = await collectPages(input);
  console.log(`${pages.length} page(s) collected\n`);
  for (const p of pages) {
    console.log(`  • [${p.via}] ${p.url}`);
    console.log(`    title: ${p.title ?? "n/a"} | published: ${p.publishedAt ?? "unknown"} | ${p.markdown.length} chars`);
    console.log(`    ${p.markdown.slice(0, 300).replace(/\n+/g, " ")}…\n`);
  }
  if (dryRun) {
    console.log("dry-run: nothing stored.");
    return;
  }
  const { id: entityId } = await upsertEntity(input);
  for (const p of pages) {
    const res = await processFinding(entityId, p);
    console.log(`  stored: ${res.status}${res.runLLM ? "" : " (LLM would be skipped)"} — ${p.url}`);
  }
}

async function stageClassify(input: EntityInput, entityId: string) {
  hr(`classify — ${input.name} (re-runs LLM on stored findings; never writes)`);
  for (const { page } of await loadPages(entityId)) {
    const c = await classify(input, page);
    const pass =
      c.is_relevant && c.is_about_entity && c.recency !== "stale" &&
      c.actionability_score >= config.tuning.minClassifyScore;
    console.log(`  ${pass ? "✓ would extract" : "· would filter"} — ${page.url}`);
    console.log(`    ${JSON.stringify(c)}\n`);
  }
}

async function stageExtract(input: EntityInput, entityId: string, dryRun: boolean) {
  hr(`extract — ${input.name}${dryRun ? " (dry-run)" : ""}`);
  for (const { finding, page } of await loadPages(entityId)) {
    console.log(`\n── ${page.url}`);
    const classification = await classify(input, page);
    const pass =
      classification.is_relevant && classification.is_about_entity &&
      classification.recency !== "stale" &&
      classification.actionability_score >= config.tuning.minClassifyScore;
    if (!pass) {
      console.log(`  · filtered by classification: ${classification.reason}`);
      continue;
    }

    const { insights, mentions } = await extract(input, page);
    const graded = insights.map((insight) => {
      const { quality, reasons } = gradeInsight(insight, classification, page.markdown);
      return { insight, quality, reasons };
    });
    for (const g of graded) {
      console.log(`  [${g.quality}] ${g.insight.signal_type} — "${g.insight.headline}"`);
      console.log(`        confidence=${g.insight.confidence} urgency=${g.insight.urgency} actionable=${g.insight.actionable}`);
      if (g.reasons.length) console.log(`        low because: ${g.reasons.join("; ")}`);
      console.log(`        ${JSON.stringify(g.insight, null, 2).split("\n").join("\n        ")}`);
    }
    if (graded.length === 0) console.log("  (no insights extracted)");

    const { kept, dropped } = filterMentions(input, page, mentions);
    for (const k of kept) console.log(`  [mention ✓] ${k.type} "${k.name}" (${k.relationship}) — ${k.reason}`);
    for (const d of dropped) console.log(`  [mention ✗] "${d.name}" — ${d.reason}`);

    if (!dryRun) {
      const n = await insertInsights(entityId, finding.id, graded, classification);
      const { proposed, skippedExisting } = await upsertCandidates(entityId, finding.id, page, kept);
      console.log(`  stored: ${n} insight(s), ${proposed} candidate(s) proposed, ${skippedExisting} already tracked`);
    }
  }
  if (dryRun) console.log("\ndry-run: nothing stored.");
}

async function stageOpportunities(input: EntityInput, entityId: string, dryRun: boolean) {
  hr(`opportunities — ${input.name}${dryRun ? " (dry-run)" : ""}`);
  const { created, skipped } = await deriveOpportunities(entityId, { dryRun });
  for (const o of created) {
    const b = o.breakdown;
    console.log(`  ★ score ${o.score} = 100 × ${b.confidence} (confidence) × ${b.urgencyWeight} (urgency) × ${b.recencyDecay} (recency, ${b.ageDays}d old)`);
    console.log(`    signal: ${o.signal_type} | insight ${o.insight_id}`);
    console.log(`    why now: ${o.why_now}`);
    console.log(`    action:  ${o.suggested_action}\n`);
  }
  for (const s of skipped) console.log(`  · skipped "${s.headline ?? s.insight_id}" — ${s.reason}`);
  console.log(`\n${created.length} ${dryRun ? "would be created" : "created"}, ${skipped.length} skipped.`);
}

async function stageDraft(input: EntityInput, entityId: string, dryRun: boolean) {
  hr(`draft — ${input.name}${dryRun ? " (dry-run)" : ""}`);
  const db = supabase();

  const oppId = arg("opportunity");
  let q = db
    .from("opportunities")
    .select("id, insight_id, score, status, signal_type")
    .eq("entity_id", entityId);
  q = oppId ? q.eq("id", oppId) : q.eq("status", "new").order("score", { ascending: false }).limit(1);
  const { data: opp, error: oErr } = await q.maybeSingle();
  if (oErr) throw oErr;
  if (!opp) {
    console.error(oppId ? `Opportunity ${oppId} not found for this entity.` : "No 'new' opportunity — run the opportunities stage first.");
    process.exit(1);
  }

  const { data: insight, error: iErr } = await db
    .from("insights")
    .select("headline, summary, why_it_matters, recommended_action, signal_type, published_at, evidence")
    .eq("id", opp.insight_id)
    .single();
  if (iErr) throw iErr;

  const p = input;
  console.log(`opportunity ${opp.id} (score ${opp.score}, ${opp.signal_type})\n`);
  const draft = await generateDraft(nebius(), {
    entity: { type: p.type, name: p.name, title: p.title, company: p.company, region: p.region },
    insight: { ...insight, evidence: (insight.evidence ?? []) as { source_url: string; excerpt: string }[] },
    model: config.nebius.model,
    temperature: config.tuning.draftTemperature,
  });

  console.log(`  subject: ${draft.subject}`);
  console.log(`  grounded: ${draft.grounded ? "✓ yes" : "✗ NO — facts not verbatim in evidence"}`);
  console.log(`\n${draft.body.split("\n").map((l) => "  │ " + l).join("\n")}\n`);
  console.log(`  facts used:`);
  for (const f of draft.facts_used) console.log(`    - "${f.slice(0, 120)}${f.length > 120 ? "…" : ""}"`);

  if (!dryRun) {
    const { data, error } = await db
      .from("drafts")
      .insert({
        opportunity_id: opp.id,
        subject: draft.subject,
        body: draft.body,
        facts_used: draft.facts_used,
        grounded: draft.grounded,
        model: draft.model,
      })
      .select("id")
      .single();
    if (error) throw error;
    console.log(`\n  stored as draft ${data.id}`);
  } else {
    console.log("\ndry-run: nothing stored.");
  }
}

async function stageAll(input: EntityInput) {
  hr(`all — full cycle for ${input.name}`);
  const r = await runEntityCycle(input, "manual");
  const s = r.stats;
  console.log(
    `\npages=${s.pagesFetched} new=${s.newFindings} changed=${s.changedFindings} deduped=${s.deduped} ` +
      `inferred=${s.inferred} filtered=${s.filtered} insights=${s.insightsCreated} lowQ=${s.lowQuality} ` +
      `opportunities=${s.opportunitiesCreated} candidates=${s.candidatesProposed}`,
  );
}

// ---------------------------------------------------------------------------

async function main() {
  const stage = process.argv[2] as Stage | undefined;
  if (!stage || !STAGES.includes(stage)) {
    console.error(`Usage: tsx scripts/run-stage.ts <${STAGES.join("|")}> --only <ingest_key> [--dry-run] [--limit N] [--url substr] [--file seed.json] [--opportunity uuid]`);
    process.exit(1);
  }
  const only = arg("only");
  if (!only) {
    console.error("--only <ingest_key> is required (e.g. --only person:tim-cook)");
    process.exit(1);
  }
  const dryRun = flag("dry-run");
  const { id, input } = await loadEntity(only);

  switch (stage) {
    case "crawl":
      return stageCrawl(input, dryRun);
    case "classify":
      return stageClassify(input, requireEntityId(id, only));
    case "extract":
      return stageExtract(input, requireEntityId(id, only), dryRun);
    case "opportunities":
      return stageOpportunities(input, requireEntityId(id, only), dryRun);
    case "draft":
      return stageDraft(input, requireEntityId(id, only), dryRun);
    case "all":
      return stageAll(input);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
