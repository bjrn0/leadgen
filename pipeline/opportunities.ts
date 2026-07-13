import { supabase } from "./clients.js";
import { config } from "./config.js";

/**
 * Opportunity derivation — turns quality-ok, actionable insights into rows in the
 * `opportunities` queue the Lead Generation view works. Deterministic (no LLM):
 * score is a pure function of fields the extract pass already produced, so the
 * ranking is explainable ("87 = confidence 0.9 × High × ≤7d") and reproducible.
 * Idempotent: unique(insight_id) + on-conflict-ignore means re-runs create nothing.
 */

export interface InsightForScore {
  id: string;
  entity_id: string;
  signal_type: string | null;
  why_it_matters: string | null;
  recommended_action: string | null;
  recency_label: string | null;
  confidence: number | null;
  urgency: string | null;
  published_at: string | null;
  created_at: string;
}

export interface ScoreBreakdown {
  score: number;
  confidence: number;
  urgencyWeight: number;
  recencyDecay: number;
  ageDays: number;
}

const URGENCY_WEIGHTS: Record<string, number> = { High: 1.0, Medium: 0.75, Low: 0.5 };

function recencyDecay(ageDays: number): number {
  if (ageDays <= 7) return 1.0;
  if (ageDays <= 14) return 0.85;
  if (ageDays <= 30) return 0.7;
  if (ageDays <= 45) return 0.55;
  return 0.4;
}

/** score = round(100 × confidence × urgencyWeight × recencyDecay). Derived, not arbitrary. */
export function computeScore(insight: InsightForScore, now = new Date()): ScoreBreakdown {
  const confidence = insight.confidence ?? 0;
  const urgencyWeight = URGENCY_WEIGHTS[insight.urgency ?? ""] ?? URGENCY_WEIGHTS.Low;
  const anchor = insight.published_at ?? insight.created_at;
  const ageDays = Math.max(0, (now.getTime() - new Date(anchor).getTime()) / 86_400_000);
  const decay = recencyDecay(ageDays);
  return {
    score: Math.min(100, Math.max(0, Math.round(100 * confidence * urgencyWeight * decay))),
    confidence,
    urgencyWeight,
    recencyDecay: decay,
    ageDays: Math.round(ageDays * 10) / 10,
  };
}

/** "why now" line for the queue card: recency + the LLM's why_it_matters. */
export function buildWhyNow(insight: InsightForScore): string {
  const recency = insight.recency_label?.trim();
  const why = insight.why_it_matters?.trim() || "Fresh signal for this account.";
  return recency && recency !== "unknown" ? `${recency} — ${why}` : why;
}

export interface DerivedOpportunity {
  insight_id: string;
  entity_id: string;
  signal_type: string | null;
  score: number;
  breakdown: ScoreBreakdown;
  why_now: string;
  suggested_action: string;
}

export interface DeriveResult {
  created: DerivedOpportunity[];
  skipped: { insight_id: string; headline?: string; reason: string }[];
}

/**
 * Derive opportunities for one entity from its ok+actionable insights that don't
 * have one yet. Anti-spam guard: skip if a 'new' opportunity for the same
 * (entity, signal_type) was created within `opportunityDedupDays` — the embedding
 * layer catches identical pages; this catches "same event, different article".
 */
export async function deriveOpportunities(
  entityId: string,
  opts: { dryRun?: boolean } = {},
): Promise<DeriveResult> {
  const db = supabase();
  const result: DeriveResult = { created: [], skipped: [] };

  const { data: insights, error: iErr } = await db
    .from("insights")
    .select(
      "id, entity_id, signal_type, headline, why_it_matters, recommended_action, " +
        "recency_label, confidence, urgency, published_at, created_at",
    )
    .eq("entity_id", entityId)
    .eq("quality", "ok")
    .eq("actionable", true)
    .order("created_at", { ascending: false });
  if (iErr) throw iErr;
  if (!insights?.length) return result;

  const { data: existing, error: oErr } = await db
    .from("opportunities")
    .select("insight_id, signal_type, status, created_at")
    .eq("entity_id", entityId);
  if (oErr) throw oErr;

  const haveInsight = new Set((existing ?? []).map((o) => o.insight_id));
  const dedupMs = config.tuning.opportunityDedupDays * 86_400_000;
  const recentNewBySignal = new Map<string, number>(); // signal_type -> newest created_at ms
  for (const o of existing ?? []) {
    if (o.status !== "new" || !o.signal_type) continue;
    const t = new Date(o.created_at).getTime();
    if (t > (recentNewBySignal.get(o.signal_type) ?? 0)) recentNewBySignal.set(o.signal_type, t);
  }

  const now = Date.now();
  for (const insight of insights as unknown as (InsightForScore & { headline: string })[]) {
    if (haveInsight.has(insight.id)) {
      result.skipped.push({ insight_id: insight.id, headline: insight.headline, reason: "already has opportunity" });
      continue;
    }
    const recentNew = insight.signal_type ? recentNewBySignal.get(insight.signal_type) : undefined;
    if (recentNew && now - recentNew < dedupMs) {
      result.skipped.push({
        insight_id: insight.id,
        headline: insight.headline,
        reason: `'new' ${insight.signal_type} opportunity created < ${config.tuning.opportunityDedupDays}d ago`,
      });
      continue;
    }

    const breakdown = computeScore(insight);
    const derived: DerivedOpportunity = {
      insight_id: insight.id,
      entity_id: entityId,
      signal_type: insight.signal_type,
      score: breakdown.score,
      breakdown,
      why_now: buildWhyNow(insight),
      suggested_action: insight.recommended_action?.trim() || "Review the signal and decide on outreach.",
    };

    if (!opts.dryRun) {
      const { error } = await db.from("opportunities").upsert(
        {
          entity_id: derived.entity_id,
          insight_id: derived.insight_id,
          signal_type: derived.signal_type,
          score: derived.score,
          why_now: derived.why_now,
          suggested_action: derived.suggested_action,
        },
        { onConflict: "insight_id", ignoreDuplicates: true },
      );
      if (error) throw error;
    }
    // The just-created 'new' opportunity participates in this run's anti-spam
    // window (also in dry-run, so the preview matches what a wet run would do).
    if (derived.signal_type) recentNewBySignal.set(derived.signal_type, now);
    result.created.push(derived);
  }
  return result;
}
