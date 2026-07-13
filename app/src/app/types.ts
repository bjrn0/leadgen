export type ViewType = "lead-generation" | "monitoring";

/** One extracted signal as exposed by the v_monitoring_accounts view. */
export interface MonitoringSignal {
  type: string | null; // signal_type, e.g. "executive_change"
  time: string | null; // ISO-8601 UTC
  title: string | null; // insight headline
  evidence: string | null; // why_it_matters
  urgency: string | null; // High | Medium | Low
}

/** A watchlist account — the dashboard shape, straight from v_monitoring_accounts. */
export interface MonitoringAccount {
  id: string;
  name: string;
  tier: string;
  urgency: string;
  score: number;
  sources: number;
  latest: string | null; // ISO timestamp
  notifications: { email: boolean; webhook: boolean };
  summary: string | null;
  signals: MonitoringSignal[];
}

export type OpportunityStatus = "new" | "contacted" | "qualified" | "dismissed";

export interface InsightEvidence {
  source_url: string;
  published_at?: string | null;
  excerpt: string;
}

/** The insight join carried by an opportunity (see GET /api/opportunities). */
export interface OpportunityInsight {
  headline: string;
  summary: string | null;
  why_it_matters: string | null;
  recommended_action: string | null;
  evidence: InsightEvidence[];
  signal_type: string | null;
  urgency: string | null;
  confidence: number | null;
  published_at: string | null;
}

/** A ranked lead-gen opportunity derived from a monitoring insight. */
export interface Opportunity {
  id: string;
  entity_id: string;
  insight_id: string;
  signal_type: string | null;
  score: number;
  status: OpportunityStatus;
  why_now: string;
  suggested_action: string;
  created_at: string;
  updated_at: string;
  entities: { name: string; type: string; profile: Record<string, unknown> | null } | null;
  insights: OpportunityInsight | null;
}

/** A generated outreach email for an opportunity. */
export interface Draft {
  id: string;
  subject: string;
  body: string;
  facts_used: string[];
  grounded: boolean;
  model: string | null;
  edited: boolean;
  created_at: string;
}

export type LeadCandidateStatus = "proposed" | "added" | "dismissed";

/** A newly-discovered entity proposed for the watchlist (new-lead discovery). */
export interface LeadCandidate {
  id: string;
  name: string;
  type: "person" | "company";
  relationship: string | null;
  reason: string | null;
  evidence: { source_url: string; excerpt: string }[];
  status: LeadCandidateStatus;
  mention_count: number;
  first_seen_at: string;
  last_seen_at: string;
  source_entity_id: string | null;
  added_entity_id: string | null;
  source_entity: { name: string } | null;
}
