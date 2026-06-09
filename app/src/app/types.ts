export type ViewType = "lead-generation" | "monitoring";

/** One extracted signal as exposed by the v_monitoring_accounts view. */
export interface MonitoringSignal {
  type: string | null; // signal_type, e.g. "executive_change"
  time: string | null; // "YYYY-MM-DD HH:MM"
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
