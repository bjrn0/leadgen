export type ViewType = "lead-generation" | "monitoring" | "settings";

/** Runtime settings edited in the Settings view (mirrors the `settings` table). */
export interface Settings {
  monitoring_interval_hours: number;
  discovery_interval_hours: number;
  browserbase_fallback: boolean;
  search_results_per_query: number;
  min_lead_fit: number;
  min_insight_confidence: number;
  dedup_similarity_threshold: number;
  min_classify_score: number;
  last_discovery_at?: string | null;
}

/** One extracted signal as exposed by the v_monitoring_accounts view. */
export interface MonitoringSignal {
  type: string | null; // signal_type, e.g. "executive_change"
  time: string | null; // ISO-8601 UTC
  title: string | null; // insight headline
  evidence: string | null; // why_it_matters
  urgency: string | null; // High | Medium | Low
}

/** A watchlist account — the dashboard shape, straight from v_monitoring_accounts. */
export interface MonitoringSource {
  id: string;
  url: string | null;
  kind: string; // 'website' | 'firecrawl_search' | 'browserbase'
  enabled: boolean;
}

export interface MonitoringAccount {
  id: string;
  name: string;
  tier: string;
  urgency: string;
  score: number;
  hotness: number | null; // 1–5, max open-opportunity tier for the account
  sources: number;
  open_roles: number; // currently-open job vacancies collected from careers surfaces
  source_urls: MonitoringSource[]; // the actual custom/seed sources, for the detail list
  latest: string | null; // ISO timestamp
  notifications: { email: boolean; webhook: boolean };
  summary: string | null;
  signals: MonitoringSignal[];
}

/** An open role collected from a careers surface (job_postings), for the Open Roles panel. */
export interface JobPosting {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  remote: boolean | null;
  seniority: string | null;
  employment_type: string | null;
  url: string | null;
  posted_at: string | null;
  status: "open" | "closed";
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
  score: number; // raw signal strength 0–100 (breakdown only)
  icp_fit: number | null; // 0–100 LLM fit to the ICP
  icp_fit_reason: string | null;
  hotness: number | null; // 1–5, the user-facing ranking
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
  discovery_source: "mention" | "icp_search";
  icp_fit: number | null;
  icp_fit_reason: string | null;
  hotness: number | null;
  first_seen_at: string;
  last_seen_at: string;
  source_entity_id: string | null;
  added_entity_id: string | null;
  source_entity: { name: string } | null;
}

/** The Ideal Customer Profile — what the user sells and who they target. */
export interface IcpProfile {
  id?: string;
  name: string;
  offering: string;
  verticals: string[];
  buyer_roles: string[];
  company_sizes: string[];
  regions: string[];
  keywords: string[];
  technologies: string[];
  pain_themes: string[];
}
