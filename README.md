# LeadGen

LeadGen is a go-to-market intelligence engine for two initial jobs:

- discover target accounts from public structured sources
- monitor watchlisted accounts and turn changes into evidence-backed sales signals

The repository is a monorepo:

- `app`: Next.js dashboard and operator UI
- `pipeline`: the backend intelligence engine (crawl → dedup → classify → extract → store)
- `trigger`: Trigger.dev tasks (`bootstrap-entity` webhook, `monitor-cycle` cron) that run the pipeline
- `scripts`: local runners (`seed-and-run`, `export-findings`)
- `supabase/migrations`: Postgres + pgvector schema and the `v_monitoring_accounts` read view
- `docs`: product, architecture, and the **[engine guide](docs/ENGINE.md)**

## The engine (start here)

How entities are stored, how a monitoring cycle is triggered (from Next.js → Trigger.dev), the data
contract the dashboard reads, and the Next.js plumbing that's already wired for the UI team — all in
**[docs/ENGINE.md](docs/ENGINE.md)**.

## Local setup

1. Create `.env.local` with your credentials (Supabase, Nebius, Firecrawl, Trigger.dev — full list
   in [docs/ENGINE.md §4](docs/ENGINE.md)). The Next.js app reads its own copy from `app/.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`, `DATABASE_SECRET_KEY`, `TRIGGER_SECRET_KEY`).
2. Install dependencies with `npm install`.
3. Apply the schema: `supabase/migrations/0001_init.sql` (Supabase SQL editor or `psql`).
4. Run the engine worker: `npx trigger.dev@latest dev` (repo root).
5. Start the dashboard: `npm run dev --workspace app`.

Backend-only flows: `npm run seed-and-run` (process `data/seed-entities.json`) and
`npm run export-findings` (dump current data to `data/output/*.json`).

## Borrowed patterns

This scaffold intentionally borrows the design language and dashboard shell ideas from the sibling `matomato/podzeus-app` project while replacing the podcast-specific product model with account intelligence concepts.

It also borrows the service split and env grouping discipline from `matomato/podtrans`, but starts with cleaner boundaries for LeadGen:

- route-based Next.js pages instead of a Redux-selected single-page shell
- fresh `leadgen` schema and tables
- source adapters and signal objects centered on accounts, watchlists, and evidence

## Initial delivery scope

- account discovery from company sites, RSS, YouTube, Greenhouse, Lever, and managed extraction fallbacks
- watchlist monitoring with 3-hour summaries
- lexical plus semantic search across collected evidence
- Slack and Telegram alert scaffolding
- compliance and suppression fields in the core data model

See [docs/product.md](docs/product.md), [docs/architecture.md](docs/architecture.md), and [docs/phases.md](docs/phases.md) for the implementation-level shape.
