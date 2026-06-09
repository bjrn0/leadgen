import { z } from "zod";

/**
 * Zod schemas are the integration contract: JSON input on one side, the LLM's
 * structured output on the other. The extraction schema is also mirrored to a
 * JSON Schema (see extract.ts) for Nebius `response_format: json_schema`.
 */

// ---------------------------------------------------------------------------
// JSON input — what the dashboard form would submit. data/seed-entities.json.
// ---------------------------------------------------------------------------
export const EntityInputSchema = z.object({
  type: z.enum(["person", "company"]),
  name: z.string().min(1),
  ingest_key: z.string().min(1),
  title: z.string().optional(),
  company: z.string().optional(),
  region: z.string().optional(),
  tier: z.string().optional(),
  seed_urls: z.array(z.string().url()).default([]),
  cadence: z.string().default("0 * * * *"),
  notifications: z
    .object({ email: z.boolean().default(true), webhook: z.boolean().default(false) })
    .default({ email: true, webhook: false }),
});
export type EntityInput = z.infer<typeof EntityInputSchema>;

export const SeedFileSchema = z.object({
  entities: z.array(EntityInputSchema).min(1),
});
export type SeedFile = z.infer<typeof SeedFileSchema>;

// ---------------------------------------------------------------------------
// LLM classification pass — cheap filter before expensive extraction.
// ---------------------------------------------------------------------------
export const ClassificationSchema = z.object({
  is_relevant: z.boolean(),
  is_about_entity: z.boolean(),
  published_at: z.string().nullable(), // ISO date if found/inferable, else null
  recency: z.enum(["recent", "stale", "unknown"]),
  // 0..1 — how actionable/insightful this page is for a salesperson. The extraction
  // pass only runs when this clears MIN_CLASSIFY_SCORE, so we don't spend tokens
  // (and risk hallucinated signals) on thin/background content.
  actionability_score: z.number().min(0).max(1),
  reason: z.string(),
});
export type Classification = z.infer<typeof ClassificationSchema>;

// ---------------------------------------------------------------------------
// LLM extraction pass — the structured insight stored + displayed.
// ---------------------------------------------------------------------------
export const SIGNAL_TYPES = [
  "hiring",
  "funding",
  "expansion",
  "partnership",
  "technology_change",
  "executive_change",
  "pain_point",
  "product_launch",
  "compliance_or_regulatory",
  "outsourcing_fit",
  "relationship_signal",
  "other",
] as const;

export const EvidenceSchema = z.object({
  source_url: z.string(),
  published_at: z.string().nullable(),
  excerpt: z.string(),
});

export const InsightSchema = z.object({
  signal_type: z.enum(SIGNAL_TYPES),
  headline: z.string(),
  summary: z.string(),
  why_it_matters: z.string(),
  recommended_action: z.string(),
  urgency: z.enum(["High", "Medium", "Low"]),
  confidence: z.number().min(0).max(1),
  actionable: z.boolean(),
  evidence: z.array(EvidenceSchema).default([]),
});
export type Insight = z.infer<typeof InsightSchema>;

// Wrapper the model returns: an array, since one page may carry 0..n signals.
export const ExtractionSchema = z.object({
  insights: z.array(InsightSchema),
});
export type Extraction = z.infer<typeof ExtractionSchema>;
