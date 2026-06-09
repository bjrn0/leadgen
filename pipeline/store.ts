import { supabase } from "./clients.js";
import { canonicalizeUrl, contentHash, embed, toVectorLiteral } from "./dedup.js";
import { config } from "./config.js";
import { EntityInputSchema, type EntityInput, type Insight } from "./schemas.js";
import type { CrawledPage } from "./crawl.js";
import type { Classification } from "./schemas.js";

export interface EntityRow {
  id: string;
  input: EntityInput;
}

/** Upsert an entity by ingest_key. Reports whether it was newly created. */
export async function upsertEntity(input: EntityInput): Promise<{ id: string; isNew: boolean }> {
  const db = supabase();
  const profile = {
    title: input.title ?? null,
    company: input.company ?? null,
    region: input.region ?? null,
    tier: input.tier ?? null,
    seed_urls: input.seed_urls,
    cadence: input.cadence,
    notifications: input.notifications,
  };

  const { data: existing, error: selErr } = await db
    .from("entities")
    .select("id")
    .eq("ingest_key", input.ingest_key)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing) {
    const { error } = await db
      .from("entities")
      .update({ type: input.type, name: input.name, profile, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, isNew: false };
  }

  const { data, error } = await db
    .from("entities")
    .insert({ type: input.type, name: input.name, ingest_key: input.ingest_key, profile })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, isNew: true };
}

/**
 * Ensure a sources row exists for each seed URL. Idempotent via select-then-insert:
 * the table's uniqueness is an *expression* index (coalesce(url, query, '')), which
 * PostgREST's onConflict can't target, so we check-then-insert per URL instead.
 */
export async function seedSources(entityId: string, input: EntityInput): Promise<void> {
  if (input.seed_urls.length === 0) return;
  const db = supabase();
  for (const rawUrl of input.seed_urls) {
    const url = canonicalizeUrl(rawUrl);
    const { data: existing, error: selErr } = await db
      .from("sources")
      .select("id")
      .eq("entity_id", entityId)
      .eq("kind", "website")
      .eq("url", url)
      .maybeSingle();
    if (selErr) throw selErr;
    if (existing) continue;

    const { error } = await db
      .from("sources")
      .insert({ entity_id: entityId, kind: "website", url, cadence: input.cadence });
    // Tolerate a race where a concurrent run inserted the same source first.
    if (error && !/duplicate key/i.test(error.message)) throw error;
  }
}

export interface FindingResult {
  findingId: string;
  status: "new" | "changed" | "duplicate";
  runLLM: boolean;
  nearDupOf?: string;
}

/**
 * Layered dedup + persistence for one crawled page:
 *  1. exact (entity_id, canonical_url) + content_hash -> unchanged duplicate (no embed, no LLM)
 *  2. same URL, different hash -> changed (embed, re-run LLM)
 *  3. new URL -> embed, pgvector near-dup check -> duplicate (skip LLM) or new (run LLM)
 */
export async function processFinding(
  entityId: string,
  page: CrawledPage,
): Promise<FindingResult> {
  const db = supabase();
  const canonical = canonicalizeUrl(page.url);
  const hash = contentHash(page.markdown);
  const excerpt = page.markdown.slice(0, 500);

  const { data: existing, error: selErr } = await db
    .from("findings")
    .select("id, content_hash")
    .eq("entity_id", entityId)
    .eq("canonical_url", canonical)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing) {
    if (existing.content_hash === hash) {
      return { findingId: existing.id, status: "duplicate", runLLM: false };
    }
    const embedding = await embed(page.markdown);
    const { error } = await db
      .from("findings")
      .update({
        content_hash: hash,
        title: page.title,
        published_at: page.publishedAt,
        observed_at: new Date().toISOString(),
        excerpt,
        raw_markdown: page.markdown,
        embedding: toVectorLiteral(embedding),
        dedup_status: "changed",
      })
      .eq("id", existing.id);
    if (error) throw error;
    return { findingId: existing.id, status: "changed", runLLM: true };
  }

  // New URL — embed and check near-duplicate against this entity's findings.
  const embedding = await embed(page.markdown);
  const { data: matches, error: rpcErr } = await db.rpc("match_entity_findings", {
    p_entity_id: entityId,
    p_embedding: toVectorLiteral(embedding),
    p_limit: 5,
  });
  if (rpcErr) throw rpcErr;
  const near = (matches ?? []).find(
    (m: { similarity: number }) => m.similarity >= config.tuning.dedupSimilarityThreshold,
  );
  const status: "new" | "duplicate" = near ? "duplicate" : "new";

  const { data: inserted, error: insErr } = await db
    .from("findings")
    .insert({
      entity_id: entityId,
      canonical_url: canonical,
      content_hash: hash,
      title: page.title,
      published_at: page.publishedAt,
      excerpt,
      raw_markdown: page.markdown,
      embedding: toVectorLiteral(embedding),
      dedup_status: status,
    })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return { findingId: inserted.id, status, runLLM: status === "new", nearDupOf: near?.id };
}

export async function insertInsights(
  entityId: string,
  findingId: string,
  graded: { insight: Insight; quality: "ok" | "low" }[],
  classification: Classification,
): Promise<number> {
  if (graded.length === 0) return 0;
  const rows = graded.map(({ insight, quality }) => ({
    entity_id: entityId,
    finding_id: findingId,
    signal_type: insight.signal_type,
    headline: insight.headline,
    summary: insight.summary,
    why_it_matters: insight.why_it_matters,
    recommended_action: insight.recommended_action,
    recency_label: relativeLabel(insight.evidence[0]?.published_at ?? classification.published_at),
    published_at: classification.published_at,
    confidence: insight.confidence,
    urgency: insight.urgency,
    actionable: insight.actionable,
    quality,
    evidence: insight.evidence,
  }));
  const { error } = await supabase().from("insights").insert(rows);
  if (error) throw error;
  return rows.length;
}

export async function startRun(
  entityId: string,
  trigger: "manual" | "cron" | "webhook",
): Promise<string> {
  const { data, error } = await supabase()
    .from("runs")
    .insert({ entity_id: entityId, trigger })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function finishRun(
  runId: string,
  status: "ok" | "error",
  stats: Record<string, number>,
  error?: string,
): Promise<void> {
  await supabase()
    .from("runs")
    .update({ status, stats, error: error ?? null, finished_at: new Date().toISOString() })
    .eq("id", runId);
}

export interface EntityOutput {
  entity_id: string;
  ingest_key: string;
  type: string;
  name: string;
  profile: Record<string, unknown>;
  monitoring: Record<string, unknown> | null; // v_monitoring_accounts (dashboard shape)
  insights: Record<string, unknown>[]; // ok first, then low; highest confidence first
  findings: Record<string, unknown>[]; // crawled artifacts (no raw_markdown — too bulky)
}

/**
 * Assemble everything we stored for one entity into a single serializable object —
 * the dashboard-shaped monitoring row, the graded insights, and the crawled findings.
 * Used by the export/output writers. Read-only (no crawl, no LLM, no spend).
 */
export async function getEntityOutput(entityId: string): Promise<EntityOutput> {
  const db = supabase();
  const { data: entity, error: eErr } = await db
    .from("entities")
    .select("id, type, name, ingest_key, profile")
    .eq("id", entityId)
    .single();
  if (eErr) throw eErr;

  const { data: insights, error: iErr } = await db
    .from("insights")
    .select(
      "signal_type, headline, summary, why_it_matters, recommended_action, recency_label, " +
        "published_at, confidence, urgency, actionable, quality, evidence, created_at",
    )
    .eq("entity_id", entityId)
    .order("confidence", { ascending: false });
  if (iErr) throw iErr;

  const { data: findings, error: fErr } = await db
    .from("findings")
    .select("canonical_url, title, published_at, observed_at, dedup_status")
    .eq("entity_id", entityId)
    .order("observed_at", { ascending: false });
  if (fErr) throw fErr;

  const { data: monitoring } = await db
    .from("v_monitoring_accounts")
    .select("*")
    .eq("id", entityId)
    .maybeSingle();

  const ranked = ((insights ?? []) as unknown as Record<string, unknown>[]).sort((a, b) => {
    if (a.quality !== b.quality) return a.quality === "ok" ? -1 : 1;
    return ((b.confidence as number) ?? 0) - ((a.confidence as number) ?? 0);
  });

  return {
    entity_id: entity.id,
    ingest_key: entity.ingest_key,
    type: entity.type,
    name: entity.name,
    profile: (entity.profile ?? {}) as Record<string, unknown>,
    monitoring: (monitoring ?? null) as Record<string, unknown> | null,
    insights: ranked,
    findings: (findings ?? []) as unknown as Record<string, unknown>[],
  };
}

/** Used by the cron task: all enabled entities, reconstructed as EntityInput. */
export async function listEnabledEntities(): Promise<EntityRow[]> {
  const { data, error } = await supabase()
    .from("entities")
    .select("id, type, name, ingest_key, profile, status")
    .eq("status", "active");
  if (error) throw error;
  return (data ?? []).map((row) => {
    const p = (row.profile ?? {}) as Record<string, unknown>;
    const input = EntityInputSchema.parse({
      type: row.type,
      name: row.name,
      ingest_key: row.ingest_key,
      title: p.title ?? undefined,
      company: p.company ?? undefined,
      region: p.region ?? undefined,
      tier: p.tier ?? undefined,
      seed_urls: p.seed_urls ?? [],
      cadence: p.cadence ?? undefined,
      notifications: p.notifications ?? undefined,
    });
    return { id: row.id, input };
  });
}

function relativeLabel(iso: string | null): string {
  if (!iso) return "unknown";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
