-- ICP (Ideal Customer Profile) layer: the anchor that makes ranking mean
-- something to the user. An LLM fit judge scores every opportunity and lead
-- against the active ICP; `hotness` (1–5) is the user-facing ranking, driven
-- primarily by that fit (see pipeline/icp.ts). The raw signal `score` stays but
-- is no longer the headline number.

-- ---------------------------------------------------------------------------
-- icp_profiles — what the user sells and who they target. Singleton in practice
-- (one active row); the table shape leaves room for future versions/segments.
-- ---------------------------------------------------------------------------
create table if not exists icp_profiles (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default 'Default ICP',
  is_active     boolean not null default true,
  offering      text,                                  -- what we sell
  verticals     text[] not null default '{}',          -- industries (hardware, chemical, …)
  buyer_roles   text[] not null default '{}',          -- titles we sell to (VP Engineering, Plant Manager)
  company_sizes text[] not null default '{}',          -- e.g. "200-1000", "1000-5000"
  regions       text[] not null default '{}',
  keywords      text[] not null default '{}',
  technologies  text[] not null default '{}',
  pain_themes   text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- At most one active profile.
create unique index if not exists icp_profiles_one_active on icp_profiles(is_active) where is_active;

-- ---------------------------------------------------------------------------
-- ICP-fit columns on the ranked objects. Nullable: rows scored before an ICP
-- exists (or when scoring is skipped) fall back to signal-only hotness.
-- ---------------------------------------------------------------------------
alter table opportunities   add column if not exists icp_fit         integer;
alter table opportunities   add column if not exists icp_fit_reason  text;
alter table opportunities   add column if not exists hotness         integer check (hotness between 1 and 5);
alter table lead_candidates add column if not exists icp_fit         integer;
alter table lead_candidates add column if not exists icp_fit_reason  text;
alter table lead_candidates add column if not exists hotness         integer check (hotness between 1 and 5);

-- Queue ordering is hotness-first now.
create index if not exists opportunities_hotness_idx on opportunities(status, hotness desc nulls last, score desc);

-- ---------------------------------------------------------------------------
-- v_monitoring_accounts — same contract as 0002, plus `hotness`: the max
-- open-opportunity tier for the account, so the watchlist can show flames.
-- ---------------------------------------------------------------------------
drop view if exists v_monitoring_accounts;
create view v_monitoring_accounts as
with recent as (
  select i.*,
         row_number() over (partition by i.entity_id order by coalesce(i.published_at, i.created_at) desc) as rn
  from insights i
  where i.quality = 'ok'
)
select
  e.id,
  e.name,
  coalesce(e.profile->>'tier', case when e.type = 'company' then 'Strategic' else 'Expansion' end) as tier,
  coalesce(max(case when r.urgency = 'High' then 'High'
                    when r.urgency = 'Medium' then 'Medium'
                    else 'Low' end), 'Low') as urgency,
  coalesce(round(avg(r.confidence) * 100)::int, 0) as score,
  (select max(o.hotness) from opportunities o
     where o.entity_id = e.id and o.status in ('new', 'contacted')) as hotness,
  (select count(*) from sources s where s.entity_id = e.id) as sources,
  to_char(max(coalesce(r.published_at, r.created_at)) at time zone 'utc',
          'YYYY-MM-DD"T"HH24:MI:SS"Z"') as latest,
  coalesce(e.profile->'notifications', '{"email": true, "webhook": false}'::jsonb) as notifications,
  (array_agg(r.summary order by coalesce(r.published_at, r.created_at) desc))[1] as summary,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'type', r.signal_type,
        'time', to_char(coalesce(r.published_at, r.created_at) at time zone 'utc',
                        'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'title', r.headline,
        'evidence', r.why_it_matters,
        'urgency', r.urgency
      ) order by coalesce(r.published_at, r.created_at) desc
    ) filter (where r.rn <= 8),
    '[]'::jsonb
  ) as signals
from entities e
left join recent r on r.entity_id = e.id
group by e.id;
