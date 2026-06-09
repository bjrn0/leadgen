import { collectPages } from "./crawl.js";
import { config } from "./config.js";
import { classify, extract } from "./extract.js";
import { gradeInsight } from "./quality.js";
import {
  finishRun,
  insertInsights,
  processFinding,
  seedSources,
  startRun,
  upsertEntity,
} from "./store.js";
import type { EntityInput } from "./schemas.js";

export interface CycleStats {
  pagesFetched: number;
  newFindings: number;
  changedFindings: number;
  deduped: number; // skipped (exact-dup or near-dup) — no LLM
  inferred: number; // pages that went through the LLM
  insightsCreated: number; // quality:ok
  lowQuality: number; // quality:low (stored but excluded from dashboard)
  filtered: number; // dropped by classification before extraction
}

export interface CycleResult {
  entityId: string;
  name: string;
  isNew: boolean;
  stats: CycleStats;
  sample?: { headline: string; recency_label: string; recommended_action: string };
}

const emptyStats = (): CycleStats => ({
  pagesFetched: 0,
  newFindings: 0,
  changedFindings: 0,
  deduped: 0,
  inferred: 0,
  insightsCreated: 0,
  lowQuality: 0,
  filtered: 0,
});

/**
 * One full monitoring cycle for a single entity, end to end:
 * upsert -> seed sources -> crawl -> dedup -> classify -> extract -> grade -> store.
 * Shared by the local runner (trigger 'manual') and Trigger.dev (cron/webhook).
 */
export async function runEntityCycle(
  input: EntityInput,
  trigger: "manual" | "cron" | "webhook" = "manual",
): Promise<CycleResult> {
  const { id: entityId, isNew } = await upsertEntity(input);
  await seedSources(entityId, input);
  const runId = await startRun(entityId, trigger);
  const stats = emptyStats();
  let sample: CycleResult["sample"];

  try {
    const pages = await collectPages(input);
    stats.pagesFetched = pages.length;

    for (const page of pages) {
      const finding = await processFinding(entityId, page);
      if (finding.status === "new") stats.newFindings++;
      if (finding.status === "changed") stats.changedFindings++;
      if (!finding.runLLM) {
        stats.deduped++;
        console.log(`    · deduped — ${page.url}`);
        continue;
      }

      const classification = await classify(input, page);
      console.log(
        `      [classify] relevant=${classification.is_relevant} about=${classification.is_about_entity} ` +
          `recency=${classification.recency} score=${classification.actionability_score} ` +
          `:: ${classification.reason}`,
      );
      // Cost-aware: drop clearly irrelevant / stale / low-actionability pages before
      // extraction. The score gate keeps us from spending tokens (and risking
      // hallucinated signals) on thin background content.
      const score = classification.actionability_score.toFixed(2);
      if (
        !classification.is_relevant ||
        !classification.is_about_entity ||
        classification.recency === "stale" ||
        classification.actionability_score < config.tuning.minClassifyScore
      ) {
        stats.filtered++;
        const why = !classification.is_relevant
          ? "not relevant"
          : !classification.is_about_entity
            ? "not about entity"
            : classification.recency === "stale"
              ? "stale"
              : `score ${score} < ${config.tuning.minClassifyScore}`;
        console.log(`    · filtered (${why}) — ${page.url}`);
        continue;
      }

      stats.inferred++;
      const insights = await extract(input, page);
      const graded = insights.map((insight) => {
        const { quality, reasons } = gradeInsight(insight, classification, page.markdown);
        return { insight, quality, reasons };
      });
      const okCount = graded.filter((g) => g.quality === "ok").length;
      stats.insightsCreated += okCount;
      stats.lowQuality += graded.length - okCount;
      console.log(
        `    ✓ extracted (score ${score}) — ${insights.length} signal(s), ${okCount} ok, ` +
          `${graded.length - okCount} low — ${page.url}`,
      );
      for (const g of graded.filter((g) => g.quality === "low")) {
        console.log(`        ↳ low: "${g.insight.headline}" — ${g.reasons.join("; ")}`);
      }

      await insertInsights(entityId, finding.findingId, graded, classification);

      if (!sample) {
        const top = graded.find((g) => g.quality === "ok")?.insight;
        if (top) {
          sample = {
            headline: top.headline,
            recency_label: classification.published_at ?? "unknown",
            recommended_action: top.recommended_action,
          };
        }
      }
    }

    await finishRun(runId, "ok", stats as unknown as Record<string, number>);
    return { entityId, name: input.name, isNew, stats, sample };
  } catch (err) {
    await finishRun(runId, "error", stats as unknown as Record<string, number>, (err as Error).message);
    throw err;
  }
}
