-- Competitive-Intelligence POC — lean schema
-- Stack: Supabase (Postgres + pgvector). Five tables + a dashboard-shaped read view.
--
-- The `embedding` column is an UNCONSTRAINED pgvector `vector` (no fixed dimension) so the
-- POC works with any Nebius embedding model without a migration change. Near-duplicate
-- detection is brute-force per-entity over a small recent window (see match_entity_findings),
-- so no ANN index is needed (and 4096-dim vectors exceed pgvector's HNSW index limit anyway).

create extension if not exists vector;
create extension if not exists pgcrypto; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- entities — both people and companies (type discriminator). The "people +
-- company" requirement. ingest_key is the idempotency anchor from the JSON.
-- ---------------------------------------------------------------------------
create table if not exists entities (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('person', 'company')),
  name        text not null,
  ingest_key  text not null unique,
  profile     jsonb not null default '{}'::jsonb, -- title, company, region, seed_urls, cadence, notifications, tier
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- sources — per-entity collection points (seed URLs + discovered search queries)
-- ---------------------------------------------------------------------------
create table if not exists sources (
  id              uuid primary key default gen_random_uuid(),
  entity_id       uuid not null references entities(id) on delete cascade,
  kind            text not null check (kind in ('firecrawl_search', 'website', 'browserbase')),
  url             text,            -- for website/browserbase kinds
  query           text,            -- for firecrawl_search kind
  cadence         text,
  enabled         boolean not null default true,
  last_checked_at timestamptz,
  failure_count   integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists sources_entity_idx on sources(entity_id);
-- one row per (entity, kind, identifier); identifier is url or query
create unique index if not exists sources_entity_ident_idx
  on sources(entity_id, kind, coalesce(url, query, ''));

-- ---------------------------------------------------------------------------
-- findings — raw crawled artifacts + dedup keys + embedding
-- ---------------------------------------------------------------------------
create table if not exists findings (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entities(id) on delete cascade,
  source_id     uuid references sources(id) on delete set null,
  canonical_url text not null,
  content_hash  text not null,
  title         text,
  published_at  timestamptz,
  observed_at   timestamptz not null default now(),
  excerpt       text,
  raw_markdown  text,
  embedding     vector,           -- unconstrained dimension
  dedup_status  text not null check (dedup_status in ('new', 'changed', 'duplicate')),
  created_at    timestamptz not null default now(),
  unique (entity_id, canonical_url)
);
create index if not exists findings_entity_idx on findings(entity_id);
create index if not exists findings_hash_idx on findings(content_hash);

-- ---------------------------------------------------------------------------
-- insights — structured LLM output the dashboard displays
-- ---------------------------------------------------------------------------
create table if not exists insights (
  id                 uuid primary key default gen_random_uuid(),
  entity_id          uuid not null references entities(id) on delete cascade,
  finding_id         uuid references findings(id) on delete set null,
  signal_type        text,        -- hiring/funding/expansion/partnership/technology_change/executive_change/product_launch/...
  headline           text not null,
  summary            text,
  why_it_matters     text,
  recommended_action text,
  recency_label      text,        -- e.g. "18 min ago", "2 days ago"
  published_at       timestamptz,
  confidence         numeric,     -- 0..1
  urgency            text,        -- High | Medium | Low
  actionable         boolean not null default false,
  quality            text not null default 'ok' check (quality in ('ok', 'low')),
  evidence           jsonb not null default '[]'::jsonb, -- [{source_url, published_at, excerpt}]
  created_at         timestamptz not null default now()
);
create index if not exists insights_entity_idx on insights(entity_id);
create index if not exists insights_created_idx on insights(created_at desc);

-- ---------------------------------------------------------------------------
-- runs — feedback-loop / job tracking
-- ---------------------------------------------------------------------------
create table if not exists runs (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid references entities(id) on delete cascade,
  trigger     text not null check (trigger in ('manual', 'cron', 'webhook')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running',
  stats       jsonb not null default '{}'::jsonb, -- pages_fetched, deduped, inferred, insights_created, low_quality
  error       text
);
create index if not exists runs_entity_idx on runs(entity_id);

-- ---------------------------------------------------------------------------
-- match_entity_findings — near-duplicate lookup for dedup.ts
-- p_embedding is passed as text (e.g. '[0.1,0.2,...]') and cast to vector, so
-- the JS client never needs the pgvector type. Cosine similarity = 1 - distance.
-- ---------------------------------------------------------------------------
create or replace function match_entity_findings(
  p_entity_id uuid,
  p_embedding text,
  p_limit     integer default 5
)
returns table (id uuid, canonical_url text, title text, similarity double precision)
language sql stable
as $$
  select f.id,
         f.canonical_url,
         f.title,
         1 - (f.embedding <=> p_embedding::vector) as similarity
  from findings f
  where f.entity_id = p_entity_id
    and f.embedding is not null
  order by f.embedding <=> p_embedding::vector
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- v_monitoring_accounts — reshapes entities + recent ok insights into the
-- dashboard's mock `accounts` shape (see app/src/app/views/monitoring-view.tsx).
-- Lets the frontend swap mock -> select with near-zero refactor. Read-only.
-- ---------------------------------------------------------------------------
create or replace view v_monitoring_accounts as
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
  (select count(*) from sources s where s.entity_id = e.id) as sources,
  max(coalesce(r.published_at, r.created_at)) as latest,
  coalesce(e.profile->'notifications', '{"email": true, "webhook": false}'::jsonb) as notifications,
  (array_agg(r.summary order by coalesce(r.published_at, r.created_at) desc))[1] as summary,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'type', r.signal_type,
        'time', to_char(coalesce(r.published_at, r.created_at), 'YYYY-MM-DD HH24:MI'),
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
