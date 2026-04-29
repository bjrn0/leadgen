# LeadGen

LeadGen is a go-to-market intelligence engine for two initial jobs:

- discover target accounts from public structured sources
- monitor watchlisted accounts and turn changes into evidence-backed sales signals

The repository is scaffolded as a monorepo:

- `app`: Next.js dashboard and operator UI
- `database`: SQL schema and bootstrap scripts
- `services/ingest`: Go polling and normalization service
- `services/worker`: Go deep-processing and signal materialization service
- `docs`: product, architecture, source strategy, and implementation notes

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the credentials you actually intend to use.
2. Install dependencies with `npm install`.
3. Initialize the database with `npm run db:init`.
4. Start the dashboard with `npm run dev:web`.

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
