import { nebius, supabase } from "./clients.js";
import { collectPages } from "./crawl.js";
import { config } from "./config.js";
import { filterMentions, upsertCandidates } from "./discovery.js";
import { classify, extract } from "./extract.js";
import { loadActiveIcp } from "./icp.js";
import { collectJobs, insertHiringInsight, upsertJobPostings, type CollectedJob } from "./jobs.js";
import { deriveOpportunities } from "./opportunities.js";
import { gradeInsight } from "./quality.js";
import { detectAtsSource, resolveCareersSurfaces } from "./resolve.js";
import { applyStoredSettings } from "./settings.js";
import {
  finishRun,
  insertInsights,
  loadCareersSources,
  processFinding,
  seedJobSource,
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
  opportunitiesCreated: number; // derived into the lead-gen queue
  candidatesProposed: number; // new-lead discovery proposals
  jobsOpened: number; // newly-detected open roles from careers surfaces
  jobsClosed: number; // roles that disappeared from careers surfaces
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
  opportunitiesCreated: 0,
  candidatesProposed: 0,
  jobsOpened: 0,
  jobsClosed: 0,
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

  // Overlay the user's Settings (thresholds, engines) onto config for this run.
  await applyStoredSettings(supabase());
  // Load the active ICP once per cycle so opportunities and lead candidates get
  // scored for fit as they're created (cached on the row).
  const icp = await loadActiveIcp(supabase());
  const icpOpts = { icp, icpClient: nebius(), model: config.nebius.model };

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
      const { insights, mentions } = await extract(input, page);
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

      // New-lead discovery: validate + store entities the page mentioned alongside
      // the target. Grounding is checked in code; no extra LLM call.
      if (mentions.length > 0) {
        const { kept, dropped } = filterMentions(input, page, mentions);
        for (const d of dropped) console.log(`        ↳ mention dropped: "${d.name}" — ${d.reason}`);
        const { proposed } = await upsertCandidates(entityId, finding.findingId, page, kept, icpOpts);
        stats.candidatesProposed += proposed;
        if (proposed > 0) console.log(`    + ${proposed} new lead candidate(s) proposed`);
      }

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

    // Job-vacancy collection: pull structured open roles from every registered
    // careers surface (ATS API or scrape+extract), merge, upsert with diff-close,
    // and emit newly-opened roles as one 'hiring' insight so the opportunity
    // derivation below picks them up. Self-contained so Phase 2 can move it out.
    let careersSources = await loadCareersSources(entityId);
    // Lazy careers-surface resolution: an entity added outside the app (seeded,
    // migrated, or created before vacancies existed) has no registered careers
    // source, so collection would silently no-op. Resolve + register on the first
    // cycle that finds none, so monitor-cycle is self-sufficient regardless of how
    // the entity got into the DB. Same guardrails as entities-server: company-only,
    // non-fatal, low-confidence resolves to no source (never crawl the wrong
    // company's jobs).
    if (careersSources.length === 0 && input.type === "company") {
      try {
        const resolved = await resolveCareersSurfaces(nebius(), config.nebius.model, input.name);
        for (const surface of resolved?.surfaces ?? []) await seedJobSource(entityId, surface.url);
        if (resolved?.surfaces.length) careersSources = await loadCareersSources(entityId);
      } catch (err) {
        console.warn(`    [jobs] careers resolution failed for ${input.name}: ${(err as Error).message}`);
      }
    }
    if (careersSources.length > 0) {
      const collected: CollectedJob[] = [];
      for (const src of careersSources) {
        try {
          const jobs = await collectJobs({ url: src.url, source: detectAtsSource(src.url) }, {
            client: nebius(),
            model: config.nebius.model,
          });
          collected.push(...jobs);
        } catch (err) {
          console.warn(`    [jobs] collection failed for ${src.url}: ${(err as Error).message}`);
        }
      }
      const { opened, closed, total } = await upsertJobPostings(entityId, collected);
      stats.jobsOpened = opened.length;
      stats.jobsClosed = closed;
      if (opened.length > 0) await insertHiringInsight(entityId, opened);
      console.log(
        `    ⚑ jobs — ${total} open role(s), ${opened.length} new, ${closed} closed`,
      );
    }

    // Convert fresh ok-insights into ranked opportunities (deterministic score,
    // idempotent; ICP fit is the LLM-scored ranking overlay).
    const derived = await deriveOpportunities(entityId, icpOpts);
    stats.opportunitiesCreated = derived.created.length;
    if (derived.created.length > 0) {
      console.log(
        `    ★ ${derived.created.length} opportunit${derived.created.length === 1 ? "y" : "ies"} derived ` +
          `(top score ${Math.max(...derived.created.map((o) => o.score))})`,
      );
    }

    await finishRun(runId, "ok", stats as unknown as Record<string, number>);
    return { entityId, name: input.name, isNew, stats, sample };
  } catch (err) {
    await finishRun(runId, "error", stats as unknown as Record<string, number>, (err as Error).message);
    throw err;
  }
}
