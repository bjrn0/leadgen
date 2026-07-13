# LeadGen Engine — how the backend works & how to drive it

This is the backend "intelligence engine": given a person or company, it crawls the open web,
removes duplicates, classifies and extracts **grounded** sales signals with an LLM, and stores them
in Supabase in a shape the dashboard can read directly. This doc is for the developers building the
dashboard — it explains how the engine is triggered, what data it produces, and exactly which
plumbing is already wired on the Next.js side so you can build the UI on top of it.

---

## 1. The one function everything shares

Every path runs the **same** end-to-end cycle, `runEntityCycle(input, trigger)` in
`pipeline/pipeline.ts`:

```
upsert entity → seed sources → crawl (Firecrawl / Browserbase)
   → dedup (content hash + pgvector near-dup)
   → classify (LLM: relevant? about the target? recent? actionability 0–1)
   → [gate: drop irrelevant / stale / low-score pages before spending tokens]
   → extract (LLM: structured signals with VERBATIM evidence quotes
              + mentioned entities for new-lead discovery — same call, no extra spend)
   → grade (quality gate, incl. evidence-grounding check that kills hallucinations)
   → store
   → derive opportunities (deterministic: score = confidence × urgency × recency)
```

It writes to eight tables and one read view (`supabase/migrations/0001_init.sql` + `0002_leadgen.sql`):

| Table | Holds |
|---|---|
| `entities` | the people/companies being tracked (`ingest_key` is the idempotency anchor) |
| `sources` | per-entity seed URLs / discovered queries |
| `findings` | crawled pages + dedup keys + embedding |
| `insights` | the structured LLM output the dashboard shows (`quality` = `ok` \| `low`) |
| `runs` | one row per cycle (status + stats) — the feedback loop |
| `opportunities` | ranked lead-gen queue derived from ok insights (`pipeline/opportunities.ts`) |
| `drafts` | AI-generated outreach emails per opportunity (on-demand only, grounded) |
| `lead_candidates` | entities discovered alongside watched accounts (`pipeline/discovery.ts`) |
| **`v_monitoring_accounts`** (view) | entities + recent `ok` insights reshaped into the dashboard's account shape |

`v_monitoring_accounts` is the contract: `id, name, tier, urgency, score, sources, latest,
notifications, summary, signals[]` where each signal is `{ type, time, title, evidence, urgency }`.
All timestamps in the view are ISO-8601 UTC; display formatting lives in `app/src/lib/format.ts`.

**Monitoring → Lead Generation link:** each quality-ok, actionable insight becomes at most one
`opportunities` row — `score = round(100 × confidence × urgencyWeight × recencyDecay)`, so the
ranking is explainable and reproducible (no extra LLM call). Outreach drafts are generated
on-demand only (`POST /api/opportunities/[id]/draft`, prompt + grounding verification in
`pipeline/outreach.ts`). New-lead discovery rides the existing extract call: mentioned entities are
validated in code (verbatim-evidence check, self-mention filter) and land in `lead_candidates` for
one-click watchlisting.

---

## 2. Three ways the engine is triggered (same cycle each time)

| Trigger | Entry point | When |
|---|---|---|
| `manual` | `scripts/seed-and-run.ts` (`npm run seed-and-run`) | local dev / backfilling from a JSON file |
| `webhook` | Trigger.dev task `bootstrap-entity` (`trigger/bootstrap-entity.ts`) | **a new entity is added — run its first cycle immediately** |
| `cron` | Trigger.dev task `monitor-cycle` (`trigger/monitor-cycle.ts`) | hourly re-check of every active entity |

**How the dashboard kicks it off:** the Next.js route `POST /api/entities` inserts the entity and
then calls `tasks.trigger("bootstrap-entity", …)`. The pipeline itself runs inside **Trigger.dev**
(Node), not in the request — so the HTTP response returns immediately and the long crawl/LLM work
happens in the background.

```
[Dashboard form] ──POST /api/entities──▶ [Next.js route]
                                            │  1. insert into `entities` (service role)
                                            │  2. tasks.trigger("bootstrap-entity", { record })
                                            ▼
                                   [Trigger.dev worker]  runEntityCycle(input, "webhook")
                                            ▼
                                   Supabase tables → v_monitoring_accounts
[Dashboard] ◀──GET /api/monitoring (TanStack Query, polls while a run is in flight)
```

> **Why not Supabase Edge Functions?** They run on Deno and can't host this Node pipeline
> (`playwright-core`, `node:crypto`, the OpenAI/Firecrawl SDKs). Trigger.dev is the correct Node
> host and is already wired. An Edge Function would only ever be thin glue — redundant with the
> Trigger.dev trigger endpoint — so we don't use one.

> **Optional alternative trigger:** instead of the route calling Trigger.dev, you can point a
> **Supabase Database Webhook** (table `entities`, event INSERT) at the `bootstrap-entity` endpoint.
> Then any insert — from the app, SQL, or an import — auto-starts a cycle. Same task, no app change.

---

## 3. What's already wired on the Next.js side (ready for the dashboard)

The plumbing is built; the **UI is intentionally still mock** (`monitoring-view.tsx`). To go live,
the dashboard team swaps the mock arrays for the hooks below — no backend work required.

| File | What it gives you |
|---|---|
| `app/src/app/providers.tsx` | `QueryClientProvider` (TanStack Query) — already mounted in `layout.tsx` |
| `app/src/lib/supabase.ts` | `supabaseAdmin()` — server-only, service-role client for API routes |
| `app/src/lib/trigger.ts` | `triggerBootstrap(record)` — fires the `bootstrap-entity` task |
| `app/src/app/api/entities/route.ts` | `POST` — validate + upsert entity + trigger first cycle |
| `app/src/app/api/monitoring/route.ts` | `GET` — returns `v_monitoring_accounts` (the account shape) |
| `app/src/app/api/entities/[id]/runs/route.ts` | `GET` — latest run status/stats (show "processing…") |
| `app/src/lib/monitoring.ts` | **client hooks**: `useMonitoring(pollMs?)` and `useAddEntity()` |
| `app/src/app/types.ts` | `MonitoringAccount` / `MonitoringSignal` types matching the view |

**Wiring the Monitoring view later is roughly:**

```tsx
const { data: accounts = [], isLoading } = useMonitoring(polling ? 5000 : false);
const addEntity = useAddEntity(); // addEntity.mutate({ type, name, seed_urls, ... })
```

`useAddEntity` POSTs to `/api/entities` and invalidates the `["monitoring"]` query on success; pass
a poll interval to `useMonitoring` so freshly-crawled signals appear without a manual refresh.

---

## 4. Local development

You need two processes. The dashboard works even if the worker is down (the entity still inserts;
it just won't be processed until a worker/cron runs).

```bash
# 0. one-time: put env in the repo-root .env.local — the single source of truth.
#    app/next.config.ts loads it for the Next.js app; pipeline/config.ts and
#    trigger.config.ts load it for the engine. Needed at minimum:
#      NEXT_PUBLIC_SUPABASE_URL=...        # your Supabase project URL
#      DATABASE_SECRET_KEY=sb_secret_...   # service-role / secret key
#      NEBIUS_API_KEY=...                  # LLM (classify/extract/drafts)
#      TRIGGER_SECRET_KEY=tr_dev_...       # omit to skip triggering (insert still works)

# 1. the engine worker (repo root — where trigger.config.ts lives)
npx trigger.dev@latest dev

# 2. the dashboard
npm run dev --workspace app
```

**Prove it without the UI** (the engine already has Tim Cook's data from local testing):

```bash
curl localhost:3000/api/monitoring | jq '.accounts[] | {name, score, signals: (.signals|length)}'
curl -X POST localhost:3000/api/entities \
  -H 'content-type: application/json' \
  -d '{"type":"company","name":"NVIDIA","tier":"Strategic","seed_urls":["https://nvidianews.nvidia.com/"]}'
# → { id, ingest_key, run_id }; watch the run in the Trigger.dev dev dashboard,
#   then re-GET /api/monitoring to see signals populate.
```

The pure-engine path (no app, no Trigger.dev) still works for backfills:
`npm run seed-and-run` (reads `data/seed-entities.json`) and `npm run export-findings` (dumps the
current DB to `data/output/*.json`).

**Stage-wise runner** — run and inspect any single pipeline stage before trusting it end-to-end
(`scripts/run-stage.ts`):

```bash
npm run run-stage -- crawl         --only person:tim-cook --dry-run   # the ONLY stage that spends Firecrawl quota
npm run run-stage -- classify      --only person:tim-cook --limit 3   # re-runs the LLM gate on stored findings
npm run run-stage -- extract       --only person:tim-cook --dry-run   # insights + discovered mentions, grounding verdicts
npm run run-stage -- opportunities --only person:tim-cook --dry-run   # score breakdowns + skip reasons
npm run run-stage -- draft         --only person:tim-cook --dry-run   # prints the generated email + grounding check
npm run run-stage -- all           --only person:tim-cook             # full runEntityCycle
```

Every stage after `crawl` reads stored `findings.raw_markdown` from the DB, so iterating on
prompts/thresholds costs LLM tokens only — no crawl quota. `--dry-run` prints what would be stored
without writing.

---

## 5. Deployment

1. **Database**: apply `supabase/migrations/0001_init.sql` then `0002_leadgen.sql` (Supabase SQL
   editor or `psql`).
2. **Engine**: `npx trigger.dev@latest deploy` (uses `trigger.config.ts`; set `TRIGGER_PROJECT_REF`).
   This deploys both `bootstrap-entity` (per-entity) and `monitor-cycle` (hourly cron).
3. **Dashboard**: deploy the `app` workspace (e.g. Vercel) with `NEXT_PUBLIC_SUPABASE_URL`,
   `DATABASE_SECRET_KEY`, and `TRIGGER_SECRET_KEY` set.
4. **(Optional)** wire the Supabase DB webhook (§2) if you want inserts outside the app to auto-run.

Config knobs (env, all optional — defaults in `pipeline/config.ts`): `NEBIUS_MODEL`,
`MIN_CLASSIFY_SCORE` (0.4), `DEDUP_SIMILARITY_THRESHOLD` (0.92), `MIN_INSIGHT_CONFIDENCE` (0.55),
`RECENCY_WINDOW_DAYS` (45), `SEARCH_RESULTS_PER_QUERY` (5).

---

## 6. Trust: why the signals aren't hallucinated

Two LLM passes, each gated:

- **Classify** scores each page (`actionability_score` 0–1) and the cycle drops irrelevant / off-
  entity / stale / low-score pages **before** the expensive extraction pass.
- **Extract** is told to copy evidence **verbatim**; then `quality.ts:evidenceIsGrounded` checks that
  each insight's evidence excerpt actually appears in the crawled page. Insights that fail
  (fabricated quotes) are stored as `quality:'low'` and **excluded from `v_monitoring_accounts`** —
  so the dashboard only ever shows grounded signals.
