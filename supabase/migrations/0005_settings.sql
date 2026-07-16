-- Runtime settings — a singleton row the user edits in the Settings tab to
-- control cadence, which crawl engines run, and the ranking thresholds that were
-- previously hardcoded (env-only) in pipeline/config.ts. The pipeline loads this
-- at the start of every cycle/discovery run and overlays it on the env defaults.

create table if not exists settings (
  id                         integer primary key default 1 check (id = 1), -- singleton
  -- cadence (gate the background jobs; the crons fire at their max rate and skip
  -- work that ran more recently than the interval below)
  monitoring_interval_hours  integer not null default 3,
  discovery_interval_hours   integer not null default 24,
  last_discovery_at          timestamptz,
  -- engines
  browserbase_fallback       boolean not null default true,
  search_results_per_query   integer not null default 5,
  -- ranking thresholds
  min_lead_fit               integer not null default 40,   -- ICP fit floor for auto-discovered leads
  min_insight_confidence     numeric not null default 0.55,
  dedup_similarity_threshold numeric not null default 0.92,
  min_classify_score         numeric not null default 0.40,
  updated_at                 timestamptz not null default now()
);

insert into settings (id) values (1) on conflict (id) do nothing;
