# Competitive-Intelligence Pipeline (POC)

JSON-driven, end-to-end monitoring of **people and companies**. Mimics what the dashboard form
would submit, then runs the whole flow: **seed → crawl → dedup → classify → extract → store**,
and prints a feedback summary. The same modules power both the local runner and the production
Trigger.dev cron/webhook path — nothing is throwaway.

> The Next.js dashboard (`app/`) is owned by a teammate and is **not** modified. This pipeline
> only produces data the dashboard can later read (including the `v_monitoring_accounts` view).

## Stack

| Role | Tool |
| --- | --- |
| Orchestration (prod) | Trigger.dev (`trigger/`, `trigger.config.ts`) |
| State + auth | Supabase (Postgres + pgvector) |
| Default crawl | Firecrawl (search + scrape) |
| Hard / JS pages | Browserbase (CDP via `playwright-core`) |
| LLM + embeddings | Nebius Token Factory (OpenAI-compatible) |

## Layout

```
data/seed-entities.json   # JSON input (mimics the dashboard form)
pipeline/                 # shared modules — the heart of the system
  config.ts  clients.ts  schemas.ts
  crawl.ts   dedup.ts     extract.ts  quality.ts  store.ts  pipeline.ts
scripts/seed-and-run.ts   # end-to-end local runner
supabase/migrations/0001_init.sql
trigger/                  # production path (reuses pipeline modules)
  monitor-cycle.ts        # hourly cron over all enabled entities
  bootstrap-entity.ts     # Supabase entities-INSERT webhook target
```

## Setup

1. **Install** (already done if deps are present): `npm install`
2. **Env**: copy `.env.example` → `.env` and fill in:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `NEBIUS_API_KEY` (+ optional `NEBIUS_MODEL`, `NEBIUS_EMBEDDING_MODEL`, `NEBIUS_BASE_URL`)
   - `FIRECRAWL_API_KEY`
   - `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID` *(optional — fallback is skipped if unset)*
   - `TRIGGER_PROJECT_REF`, `TRIGGER_SECRET_KEY` *(only for the production path)*
3. **Database**: apply `supabase/migrations/0001_init.sql` (Supabase SQL editor, or
   `supabase db push` / `psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql`). Enables
   `pgvector`, creates the 5 tables, the `match_entity_findings` RPC, and `v_monitoring_accounts`.

## Run it

```bash
npm run seed-and-run                              # all entities in data/seed-entities.json
tsx scripts/seed-and-run.ts --only person:tim-cook
tsx scripts/seed-and-run.ts --file data/other.json
```

Per-entity output: new vs already-stored, then `pages / new / changed / deduped / inferred /
filtered / insights / lowQ`, plus a sample insight.

## Verify (end-to-end)

1. First run → entities reported `✚ new`, pages fetched, insights created, sample printed.
2. **Re-run** → entities reported `• already stored`, `deduped` up, `inferred ≈ 0`, no new
   insights. This proves the dedup/overlap logic (the hourly cron won't re-infer the same story).
3. Query Supabase:
   ```sql
   select headline, recommended_action, confidence, quality from insights order by created_at desc;
   select * from v_monitoring_accounts;
   ```

## How dedup avoids re-inference (the reliability concern)

`store.processFinding` is layered, cheapest-first:
1. **Exact**: `canonicalizeUrl` + `contentHash`. Same `(entity_id, canonical_url)` + same hash →
   `duplicate`, **no embedding, no LLM**.
2. **Changed**: same URL, new hash → `changed`, re-embed + re-run LLM (treated as an update).
3. **Near-dup**: new URL → embed, then `match_entity_findings` (pgvector cosine) vs the entity's
   findings. ≥ `DEDUP_SIMILARITY_THRESHOLD` → `duplicate` (stored for provenance, **LLM skipped**);
   else `new` → run LLM.

A cheap **classification pass** then drops irrelevant/off-entity/stale pages before the expensive
**extraction pass**, and a **quality gate** (`gradeInsight`) marks weak insights `quality:'low'`
(stored but excluded from `v_monitoring_accounts`).

## Tuning (env, optional)

`RECENCY_WINDOW_DAYS` (45) · `DEDUP_SIMILARITY_THRESHOLD` (0.92) · `MIN_INSIGHT_CONFIDENCE` (0.55)
· `SEARCH_RESULTS_PER_QUERY` (5) · `MAX_CHARS_PER_CHUNK` (12000)

## Production path (Trigger.dev)

- Deploy: `npx trigger.dev@latest deploy` (uses root `trigger.config.ts`).
- **`monitor-cycle`** — hourly cron; iterates `listEnabledEntities()` → `runEntityCycle(input, "cron")`.
- **`bootstrap-entity`** — point a **Supabase Database Webhook** (table `entities`, event INSERT)
  at this task's Trigger.dev endpoint so a newly added entity is processed immediately instead of
  waiting for the next cron tick.
- Actual fetching is delegated to Firecrawl/Browserbase (managed), satisfying Trigger.dev's
  policy against direct third-party scraping on its cloud.

## Out of scope (POC)

Logged-in social scraping (LinkedIn/IG/FB), Apify, Cloudflare AI Gateway, the full spec data
model, notification delivery, and compliance/audit tables.
```
