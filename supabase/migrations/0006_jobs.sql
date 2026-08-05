-- Job-vacancy collection (Phase 1). Structured open roles per monitored account,
-- collected from every careers surface a company exposes (its own /careers page
-- and/or a Greenhouse/Lever ATS board). Vacancies feed the existing hiring signal
-- → opportunity funnel; no LinkedIn/paid providers yet (Phase 2).

-- ---------------------------------------------------------------------------
-- Extend sources.kind with 'careers'. The 0001 CHECK is an inline (auto-named)
-- constraint; drop-and-recreate to add the new kind. ('linkedin_jobs' → Phase 2.)
-- ---------------------------------------------------------------------------
alter table sources drop constraint if exists sources_kind_check;
alter table sources add constraint sources_kind_check
  check (kind in ('firecrawl_search', 'website', 'browserbase', 'careers'));

-- ---------------------------------------------------------------------------
-- job_postings — one row per role per account. dedup_key makes re-crawls
-- idempotent (external ATS id when available, else normalized title|location);
-- status/closed_at come from account-level diffing of successive snapshots.
-- ---------------------------------------------------------------------------
create table if not exists job_postings (
  id               uuid primary key default gen_random_uuid(),
  entity_id        uuid not null references entities(id) on delete cascade,
  source           text not null default 'careers'
                     check (source in ('careers', 'greenhouse', 'lever', 'linkedin')),
  external_job_id  text,            -- ATS job id when available, else null
  dedup_key        text not null,   -- external_job_id, else norm(title)|norm(location)
  title            text not null,
  department       text,
  location         text,
  remote           boolean,
  seniority        text,
  employment_type  text,
  url              text,
  posted_at        timestamptz,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  closed_at        timestamptz,
  status           text not null default 'open' check (status in ('open', 'closed')),
  evidence         jsonb not null default '[]'::jsonb, -- [{source_url, excerpt}]
  raw              jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  unique (entity_id, dedup_key)
);
create index if not exists job_postings_entity_idx on job_postings(entity_id, status);
create index if not exists job_postings_seen_idx on job_postings(last_seen_at desc);

-- ---------------------------------------------------------------------------
-- v_monitoring_accounts — same contract as 0003, plus `open_roles`: the count of
-- currently-open vacancies for the account (mirrors the `sources` count subquery).
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
  (select count(*) from job_postings j
     where j.entity_id = e.id and j.status = 'open') as open_roles,
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
