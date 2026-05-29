---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories']
inputDocuments:
  - _bmad-output/specs/spec-leadgen/SPEC.md
  - specs/architecture.md
  - specs/data-model.md
  - specs/sources.md
  - specs/ui-mapping.md
  - specs/phases.md
  - specs/LeadGen Monitoring feature.md
  - docs/index.md
  - docs/project-overview.md
  - docs/architecture.md
  - docs/data-models.md
  - docs/component-inventory.md
  - docs/source-tree-analysis.md
  - docs/development-guide.md
  - project-context.md
---

# leadgen - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for **LeadGen — Go-to-Market Intelligence Engine**, decomposing the requirements from the canonical SPEC contract (used in place of a formal PRD), the companion architecture / data-model / sources / ui-mapping / phases / monitoring-backlog specs, and the brownfield project documentation into implementable stories.

> **Note on inputs:** No formal `PRD.md` / `Architecture.md` / `UX.md` exist. The canonical product contract is `SPEC.md` (15 capabilities = functional requirements, constraints = NFRs). The companion specs supply the technical/architecture and UX-equivalent requirements; `specs/ui-mapping.md` is treated as the UX design input. Brownfield `docs/` describe the current implementation state (a frontend prototype only).

## Requirements Inventory

### Functional Requirements

**Lead Generation (Discovery)**

FR1: A user defines an ICP rule (vertical, region, company size, buyer focus, keywords, technologies, funding/job-title/pain triggers) with Discovery Intent and Notification routing as clearly separated sections. [CAP-1, ui-mapping]
FR2: For each active ICP rule the engine discovers matching companies and decision-makers and returns them to a discovery inbox. [CAP-1]
FR3: Each discovery-inbox lead card shows company name, segment/vertical, urgency, fit score, notification-routing icons (email + webhook), and a short source-backed reason why the lead appeared; the inbox shows counts (visible + matching), max 5 visible cards with scroll, pagination controls, and selected-lead state. [CAP-1, ui-mapping]
FR4: A discovery filters modal (minimum fit score, vertical, region, company size, buyer focus, reset, apply) mirrors the ICP dimensions and updates only local query state with no ingestion side effect. [ui-mapping]
FR5: The lead workspace shows the selected company header, routing icons, a "What Happened" summary, key signals, an evidence timeline, enriched contacts, primary actions (Add to Watchlist, Push to CRM, Suppress), and batch actions (Mark as Qualified, Watch Similar Companies, Export Selected Evidence). [ui-mapping]

**Account Monitoring**

FR6: A user can add a monitored company (name required; domain and account type/status optional) and a monitored person (full name required; title, company, public-profile URL optional); each appears in the watchlist/list with an initially empty detail view and a status of active or paused. [CAP-2, Monitoring Story 1.1/1.2]
FR7: The watchlist/list view shows account and person cards/rows with name, type (Company/Person), tier, latest-signal time, source count, urgency, signal-strength score, group/tag, and routing icons; it shows counts (visible + total), max 5 visible cards with scroll, pagination/lazy loading, selected state, and default sort by latest signal or urgency. [CAP-2, ui-mapping, Monitoring Story 1.3]
FR8: The account intelligence hub shows the selected account header, routing icons, a "Last 3 Hours / what changed" breakdown, an evidence timeline, alert rules, custom sources, next-best-actions in the same hub, and actions (Create Task, Draft Email, Start Outreach, Log in CRM). [CAP-2, ui-mapping]
FR9: The "Last 3 Hours / what changed" evidence-backed breakdown is generated on a cadence configurable per account and per source (default 3-hour digest). [CAP-2]
FR10: A company timeline is sorted most-recent-first, each event showing title, summary, source, timestamp, and urgency, with time-window filters (24h / 7d / 30d / 90d / 6m) and no duplicate events displayed. [Monitoring Story 4.2]
FR11: A person detail page shows name, title, linked company, latest signal, a person timeline, and a profile link; a person can be linked to a company with navigation between them, and optionally person events appear in the company timeline. [CAP-2, Monitoring Story 5.1/5.2]
FR12: A discovered lead can be promoted into Monitoring via "Add to Watchlist", creating a `watchlist_account`, copying its existing signals/evidence into the account timeline, and starting the monitoring schedule — without creating a duplicate "lead queue" concept inside Monitoring. [CAP-4]
FR13: The Add Account modal creates an account record, source-registry entries, notification routes, and scheduler entries; Refresh Now enqueues immediate source checks; Add Custom Source creates a source and runs its first fetch. [ui-mapping]

**Shared Engine: Evidence, Ingestion, Scoring, Search**

FR14: Every lead, alert, score, and recommendation links to at least one `signal_evidence` row (source_url, source_type, timestamps, excerpt, diff, structured_evidence_json, confidence, urgency, recommended_action, raw_artifact_pointer); a signal with no evidence is rejected as invalid output. [CAP-3, data-model]
FR15: A single ingestion pipeline absorbs structured feeds/APIs (RSS, YouTube, Greenhouse, Lever), managed web/social extraction (Firecrawl, Bright Data, WebShare), and multimedia transcription into the same artifact/signal/evidence tables; expensive providers run only when configured for that source. [CAP-5, sources, architecture]
FR16: A per-ICP-rule / per-account source registry stores owner context, adapter type, URL/external identifier, cadence, last-observed state, dedupe-key strategy, extraction provider, cost category, enabled state, failure count, and last successful fetch; sources can be added manually and obvious sources can be auto-discovered from a company domain. [sources]
FR17: Scheduled polling checks each source on its cadence, stores a last-checked timestamp, logs each attempt, and isolates failures so one failed source never blocks others. [Monitoring Story 2.2, constraints]
FR18: Raw updates are normalized into structured events (entity ID, title, summary, source type + URL, published timestamp, detected timestamp, urgency) at both company and person level, linked to their entities. [Monitoring Story 2.3]
FR19: Ingestion is idempotent — re-ingesting identical source content produces no new lead/signal/alert rows, enforced by the per-source-type dedupe keys (feed GUID, video ID, ATS job ID, normalized URL + ETag/hash, provider record ID, transcript chunk hash, etc.). [CAP-6, data-model]
FR20: Leads carry an explainable, decaying score (ICP fit, signal strength, recency, contact quality, urgency, suppression factors) and monitored accounts carry an account-specific decaying score (urgency, novelty, relevance, tier, actionability, confidence). [CAP-7, data-model]
FR21: A hybrid search (Postgres lexical + Pinecone semantic + Cohere rerank) spans evidence, signals, contacts, and summaries across both pillars, scoped by metadata filters that preserve context (discovery vs monitoring, source type, account, ICP rule, watchlist, geography, buyer role, time window). [CAP-8, data-model]

**Activation, Notifications, Compliance, Collaboration, Export**

FR22: A user can act on a lead/account (Start Outreach, Push/Log to CRM, Create Task, Draft Email) and each action emits a traceable event (`outreach_event`, CRM sync, task) tied to the originating evidence. [CAP-9, ui-mapping]
FR23: Notifications route per ICP rule and per monitored account to a configured Resend email address and a webhook URL; high-confidence/urgent matches deliver an alert recorded as an `alert_delivery`. [CAP-10]
FR24: Suppression, lawful basis, opt-out, ownership, and audit are first-class objects: a suppression check runs before every outbound action, lawful-basis and opt-out state are stored per entity, suppressed companies/contacts are blocked from outreach routing, and every user and system action is recorded in the audit log. [CAP-9, CAP-11, data-model]
FR25: A monitored entity can carry one or more groups/tags, visible in list and detail views, with filtering by tag/group. [CAP-12, Monitoring Story 1.4]
FR26: A user can set follow-up reminders (title, date/time, optional note) on a monitored entity with no CRM dependency; reminders appear in the entity detail and overdue reminders are highlighted. [CAP-13, Monitoring Story 6.3]
FR27: A user can claim or be assigned ownership of an entity (visible owner), and an activity log records entity creation, owner changes, reminder creation, and status changes in the detail view. [CAP-14, Monitoring Epic 7]
FR28: A user can produce a one-way CSV export of monitored entities (name, type, latest signal, urgency, timestamp, optional source links) that respects the active filters. [CAP-15, Monitoring Epic 8]

### NonFunctional Requirements

NFR1: **Evidence-first integrity.** No lead, alert, score, or recommendation may exist without linked source evidence; evidence-less signals are invalid output. [Constraint]
NFR2: **Idempotency by default.** All writes are keyed by source-specific dedupe identifiers; retries and repeated checks must not duplicate records. [Constraint]
NFR3: **Hot path / cold path split.** The hot path completes in seconds and avoids LLM, embedding, and transcription calls; the expensive cold path runs only for items the hot path judged relevant. [Constraint, architecture]
NFR4: **Compliance from day one.** Suppression is checked before outreach; lawful-basis metadata and audit trails are core objects, not later add-ons. [Constraint]
NFR5: **Cost-aware.** Every Nebius AI Studio, Cohere, Pinecone, Firecrawl, Bright Data, proxy, and transcription call is logged and budgetable, with cost counters and usage alarms. [Constraint, phases]
NFR6: **AWS-native for V1.** RDS Postgres (with pgvector) is the system of record; S3 holds raw artifacts/snapshots/audio/transcripts/LLM JSON; EventBridge Scheduler + EventBridge + SQS + Lambda + Step Functions orchestrate; Pinecone is production vector search; Cohere does rerank/embeddings; Temporal is not used in V1. [Constraint, architecture]
NFR7: **Fixed source collection priority.** Official API → RSS/feed/structured endpoint → conditional HTTP (ETag/Last-Modified) → Firecrawl → Bright Data → custom Go adapter with WebShare proxy. [Constraint, sources]
NFR8: **Managed providers for LinkedIn/social only.** No user-owned personal-login automation; social personal data is treated as regulated and audit-sensitive (provenance logged, suppression/deletion supported). [Constraint, sources]
NFR9: **Failure isolation & resilience.** One failed source must never block other sources or the system; dead-letter queues and retry/backoff policies protect failed ingestion/processing jobs. [Constraint, phases]
NFR10: **Context separation.** Discovery signals and monitoring signals remain distinct everywhere — including search; Monitoring must read as account actions, not rediscovery. [Constraint, ui-mapping]
NFR11: **One Person entity.** A single Person model is shared across both pillars — a lead-gen decision-maker and a monitored person are the same entity, not parallel models. [Constraint]
NFR12: **Observability.** CloudWatch dashboards cover adapter errors, cold-path failures, latency, and provider usage; polling attempts and source-health state are logged. [phases]
NFR13: **Authentication.** Dashboard auth is via Clerk and is optional in development (`NEXT_PUBLIC_AUTH_MODE=dev-bypass` disables it); auth must not be hard-required. [architecture, project-context]
NFR14: **Hosting.** The Next.js dashboard targets Vercel. [architecture]
NFR15: **Consistent timezone handling** for recency indicators and timestamps across the UI. [Monitoring Story 6.2]

### Additional Requirements

_Technical / infrastructure / setup requirements from Architecture and brownfield documentation that shape implementation order:_

- **Current state = frontend prototype only.** The repo today is a Next.js 15 / React 19 / TS 5.9 / Tailwind v4 / shadcn-ui dashboard rendering hardcoded mock arrays (`leads[]`, `accounts[]`) with toast-only actions. There is NO backend, database, API layer, or ingestion pipeline. The `database/` and `services/` folders referenced by README/`db:init` DO NOT EXIST. **Epic 1 must bootstrap the backend foundation** alongside the existing UI prototype (this is greenfield backend work, not a starter template).
- **RDS Postgres + pgvector schema** covering all data-model tables: accounts, watchlists, watchlist_accounts, account_source_registry, account_notification_routes, icp_rules (+versions), lead_candidates/scores/contacts/actions, sources/fetch_state/credentials/adapter_runs, artifacts/snapshots, transcripts/chunks, signal_candidates/signals/signal_evidence/signal_scores, account_timeline_events, monitoring_summaries, contacts/enrichment, crm_links, alert_destinations/deliveries, notification_routes, outreach_events, suppression_entries, lawful_basis_records, audit_log.
- **S3 buckets** for raw artifacts, page snapshots, audio/video, transcripts, and extraction JSON.
- **Event skeleton:** EventBridge Scheduler (continuous ICP/watchlist polling), EventBridge + SQS routing, Step Functions cold-path workflow shell, Lambda for Go source adapters / hot-path detector / activation handlers.
- **Go source-adapter interface** for ingestion (services/ingest, services/worker per README intent).
- **API layer between UI and backend** does not exist yet and must be created as a deliberate new layer; the single-route, all-client-component, local-state UI must be refactored to fetch real data and emit real events (replacing mock arrays and `toast.*` simulations).
- **Notification channel resolution:** specs say Resend (email) + webhook, `.env.example` says Slack + Telegram, the UI shows generic email + webhook icons. CAP-10/SPEC commits to **Resend email + webhook** — resolve to this; do not implement Slack/Telegram.
- **Activation playbooks** via n8n / Lambda for CRM sync, tasks, sequences, and webhooks (one-way CRM push only in V1; bidirectional sync and Apollo/API integrations are documented future hooks).
- **External services to integrate:** Nebius AI Studio (structured LLM extraction), Cohere (rerank/embeddings), Pinecone (vector search), Firecrawl, Bright Data, WebShare proxy, Resend.
- **No test framework or CI is configured.** Adding tests, CI, and Vercel deployment config is greenfield and must be planned explicitly.

### UX Design Requirements

_Extracted from `specs/ui-mapping.md` (UX design input) and `docs/component-inventory.md` (current design system):_

UX-DR1: Two distinct primary modes — **Lead Generation** (broad, triage-focused discovery inbox) and **Monitoring** (deep, account-focused intelligence hub) — sharing navigation, search, evidence views, notifications, contacts, CRM actions, and compliance state, but with clearly different user intent. Currently switched via a `useState<ViewType>`; future split into routes (`/search`, `/contacts`, `/integrations`, `/settings`, `/suppression`, `/audit`) is a deliberate refactor.
UX-DR2: Discovery-inbox layout — counts (visible + matching), max 5 visible lead cards with scroll, pagination controls, selected-lead state, and the card fields defined in FR3.
UX-DR3: Modals — Filters opens from a top `Filters` button (not embedded in the inbox); the New ICP Rule modal separates **Discovery Intent** and **Notifications** (Resend email + webhook URL) into clearly distinct sections.
UX-DR4: Watchlist left column — counts (visible + total), max 5 visible account cards with scroll, pagination, selected-account state, and the card fields defined in FR7; Add Account modal collects name, tier, source list, and notification routing (Resend email + webhook URL).
UX-DR5: Evidence links must be visible and clickable, opening in a new tab with graceful broken-link handling; action buttons pair a lucide-react icon with a label; status and routing state use compact badges/icons.
UX-DR6: Shared design system — brand theme via CSS variables (`--brand`, `--brand-light`, `--brand-border`); shadcn/ui primitives + CVA variant props (Badge variants brand/danger/warning/secondary/outline); `cn()` for class composition; lucide-react icons; sonner toasts.
UX-DR7: Consolidate known duplication — extract `NotificationIcon` and `urgencyVariant` (duplicated across both views) into a shared module, and replace the hand-rolled fixed-overlay modals with a shared Radix Dialog.
UX-DR8: Do not duplicate the "lead queue" concept inside Monitoring; Monitoring actions must read as account actions, not rediscovery — preserving the discovery-vs-monitoring context separation (NFR10).

### FR Coverage Map

FR1: Epic 2 — Define ICP rule (Discovery Intent + Notifications)
FR2: Epic 2 — Engine discovers matching companies/people per ICP rule
FR3: Epic 2 — Discovery-inbox lead cards (fields, counts, pagination)
FR4: Epic 2 — Discovery filters modal mirroring ICP dimensions
FR5: Epic 2 — Lead workspace (summary, signals, evidence, contacts, actions)
FR6: Epic 3 — Add monitored company/person (status active/paused)
FR7: Epic 3 — Watchlist/list view (cards, counts, sort, pagination)
FR8: Epic 3 — Account intelligence hub (breakdown, timeline, actions)
FR9: Epic 3 — "Last 3 Hours / what changed" on configurable cadence
FR10: Epic 3 — Company timeline (sort, fields, time-window filters, no dupes)
FR11: Epic 3 — Person detail + person↔company linking & navigation
FR12: Epic 3 — Promote lead → watchlist (with source ICP/lead traceability)
FR13: Epic 3 — Add Account modal, Refresh Now, Add Custom Source
FR14: Epic 1 — Evidence-first integrity (≥1 signal_evidence row per signal)
FR15: Epic 1 (one structured source e2e) + Epic 4 (full three-pillar coverage)
FR16: Epic 1 (source registry) + Epic 4 (auto-discovery from company domain)
FR17: Epic 1 — Scheduled polling with last-checked, logging, failure isolation
FR18: Epic 1 — Event normalization (company + person level)
FR19: Epic 1 — Idempotent ingestion via per-source-type dedupe keys
FR20: Epic 2 (lead scoring) + Epic 3 (account scoring) — explainable, decaying
FR21: Epic 5 — Hybrid search (lexical + semantic + rerank) with context filters
FR22: Epic 6 — Act on lead/account (outreach, CRM push/log, task, draft email)
FR23: Epic 6 — Notification routing (Resend email + webhook), alert_delivery
FR24: Epic 1 (compliance substrate: lawful_basis/suppression/audit logging) + Epic 6 (gate activation before outbound)
FR25: Epic 7 — Groups/tags, visible in list & detail, filterable
FR26: Epic 7 — Follow-up reminders (no CRM dependency), overdue highlighting
FR27: Epic 7 — Ownership claim/assign + activity log
FR28: Epic 7 — One-way CSV export respecting active filters

## Epic List

> **Value gradient:** **Epics 1–3 = MVP core** (satisfy the SPEC "success signal": ICP → scored evidence-backed leads; watchlist → continuous "what changed"; every recommendation source-backed; no duplicates; discovery-vs-monitoring always obvious). **Epics 4–7 = V1 scope** (full source coverage, search, activation, collaboration). **Epic 8 = operational production-readiness.**
>
> **Definition of Done for any UI-touching epic:** the relevant hardcoded mock array (`leads[]` / `accounts[]`) and `toast.*`-only actions are replaced with real API-backed data and real backend events **within that epic** — fake data must not survive past the epic that makes it real.

### Epic 1: Evidence Foundation & First Real Signal
Stand up the shared platform and prove the value atom end-to-end: a user sees the first real, source-backed signal in the dashboard (rendered from RDS, replacing mock data for that slice) instead of fabricated data. This epic builds the full RDS + pgvector schema (all data-model tables, including the compliance substrate `lawful_basis_records` / `suppression_entries` and the `audit_log`), S3 buckets, the EventBridge Scheduler + EventBridge + SQS + Step Functions event skeleton, the Go source-adapter interface, the API layer between UI and backend, and the Clerk dashboard shell. It runs ONE structured source (RSS) through a complete hot-path detector → cold-path (Step Functions) → Nebius enrichment → evidence pipeline, where the enrichment provider has a swappable stub/mock implementation so downstream epics develop without live, costly keys. `signal_evidence` / `structured_evidence_json` are designed up front for all 11 signal types. It establishes the reusable shared-UI layer (`NotificationIcon`, `urgencyVariant`, a Radix `Dialog` wrapper, badge variants) and base per-call cost logging + provenance/audit logging.
**FRs covered:** FR14, FR15 (single source e2e), FR16 (registry), FR17, FR18, FR19, FR24 (compliance substrate). **NFR anchors:** NFR1, NFR2, NFR3, NFR4 (substrate), NFR5 (per-call logging), NFR6, NFR8 (provenance substrate), NFR9, NFR11, NFR13, NFR14.

### Epic 2: Lead Generation & ICP Discovery
Users define ICP rules and receive scored, evidence-backed leads in a discovery inbox with filters and a lead workspace, powered by the hot/cold engine from Epic 1. Includes lead scoring (explainable, decaying) and the early UX-DR7 cleanup of legacy duplication (consuming Epic 1's shared-UI layer); the `leads[]` mock array is replaced with real API-backed data within this epic.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR20 (lead scoring). **NFR anchors:** NFR10. **UX:** UX-DR1, UX-DR2, UX-DR3, UX-DR5, UX-DR6, UX-DR7.

### Epic 3: Account Monitoring & Intelligence Hub
Users add companies and people to a watchlist and get continuous source checks, an account timeline, the "Last 3 Hours / what changed" breakdown, person detail with person↔company linking and navigation, and account-specific (decaying) scoring. The closing story promotes a discovered lead into Monitoring (creating a `watchlist_account`, copying signals/evidence into the timeline, starting the schedule, and preserving traceability to the originating ICP rule/lead) — without duplicating the "lead queue" concept. The `accounts[]` mock array is replaced with real API-backed data within this epic. Decoupled from Epic 2 except for the promote story, so the two can proceed in parallel.
**FRs covered:** FR6, FR7, FR8, FR9, FR10, FR11, FR12 (closing), FR13, FR20 (account scoring). **NFR anchors:** NFR10, NFR15. **UX:** UX-DR4, UX-DR5, UX-DR6, UX-DR8.

### Epic 4: Expanded Source Coverage — Social, Multimedia & ATS Signals
Signals from the source types users actually care about — job boards (Greenhouse/Lever), YouTube/podcasts (multimedia transcription), and protected/social pages (LinkedIn via Bright Data) — start appearing as evidence, all flowing into the same artifact/signal/evidence tables. Adds the full structured feeds/APIs, managed extraction (Firecrawl, Bright Data, WebShare), and multimedia transcription, plus auto-discovery of obvious sources from a company domain. Builds on Epic 1's adapter interface and Epic 1's compliance/provenance substrate (so regulated social data is captured lawfully from the start).
**FRs covered:** FR15 (full three-pillar), FR16 (auto-discovery). **NFR anchors:** NFR7, NFR8.

### Epic 5: Hybrid Search Across Pillars
Users search across evidence, signals, contacts, and summaries with hybrid retrieval (Postgres lexical + Pinecone semantic + Cohere rerank), scoped by metadata filters that preserve discovery-vs-monitoring context, source type, account, ICP rule, watchlist, geography, buyer role, and time window.
**FRs covered:** FR21. **NFR anchors:** NFR10.

### Epic 6: Activation & Compliance Gate
Users move from insight to action — Start Outreach, Push/Log to CRM, Create Task, Draft Email — with notifications routed to Resend email + webhook, and every outbound action gated by an active suppression / lawful-basis / opt-out check and recorded in the audit log. Activates the compliance gate built on Epic 1's substrate so suppressed companies/contacts are blocked from outreach routing.
**FRs covered:** FR22, FR23, FR24 (gate activation). **NFR anchors:** NFR4.

### Epic 7: Collaboration & Export
Teams organize and extract their work: groups/tags on monitored entities (filterable, visible in list & detail), follow-up reminders (no CRM dependency, overdue highlighted), ownership claim/assign with an activity log, and a one-way CSV export that respects active filters and suppression/opt-out state.
**FRs covered:** FR25, FR26, FR27, FR28.

### Epic 8: Reliability, Cost & Governance Hardening
Operators can trust the system runs within budget and recovers from failures: CloudWatch dashboards for adapter errors, cold-path failures, latency, and provider usage; dead-letter queues for failed ingestion/processing jobs; cost counters and spend dashboards for every provider; retry/backoff policies; and source-health state. Builds the operational visualization on top of the base cost/provenance logging started in Epic 1.
**FRs covered:** — (NFR-driven). **NFR anchors:** NFR5 (dashboards), NFR9, NFR12.

## Epic 1: Evidence Foundation & First Real Signal

Stand up the shared platform and prove the value atom end-to-end: a user sees the first real, source-backed signal in the dashboard, rendered from RDS instead of mock data. Establishes the schema (created incrementally per story), the AWS event skeleton, the ingestion-to-evidence pipeline on one structured source (RSS), the compliance/audit substrate, and the reusable dashboard shell.

**FRs covered:** FR14, FR15 (single source e2e), FR16 (registry), FR17, FR18, FR19, FR24 (compliance substrate) · **NFR anchors:** NFR1, NFR2, NFR3, NFR4, NFR5 (per-call logging), NFR6, NFR8, NFR9, NFR11, NFR13, NFR14

### Story 1.1: Backend Foundation & Source Registry

As an operator,
I want to register a data source and have it persisted in a real database,
So that the engine has a system of record to schedule and track ingestion against.

**Acceptance Criteria:**

**Given** the repository currently has no `database/` package or backend,
**When** the backend foundation is initialized,
**Then** a `database/` package exists with migration tooling, an RDS Postgres connection (with the `pgvector` extension enabled), and the `db:init` script runs successfully against it.

**Given** the foundation is in place,
**When** the `sources`, `source_fetch_state`, and `source_adapter_runs` tables are migrated,
**Then** a source can be created carrying owner context (ICP rule or account placeholder), adapter type, URL/external identifier, cadence, dedupe-key strategy, extraction provider, cost category, enabled state, failure count, and last-successful-fetch fields.

**Given** the source tables exist,
**When** a client calls the API layer to register and list a source,
**Then** the source persists in RDS and is returned by the list endpoint, with no hardcoded mock data involved.

**And** RDS Postgres is the system of record (NFR6) and no other data-model tables are created in this story beyond those listed above.

**And given** the AWS-native target (NFR6),
**When** infrastructure is created,
**Then** all AWS resources (RDS, S3, EventBridge, SQS, Step Functions, Lambda) are provisioned via Infrastructure-as-Code (e.g., Terraform/CDK) so environments are reproducible rather than hand-configured.

### Story 1.2: Compliance & Audit Substrate

As a compliance officer,
I want lawful-basis, suppression, provenance, and audit logging to exist before any ingestion runs,
So that the product satisfies "compliance from day one" rather than retrofitting it later.

**Acceptance Criteria:**

**Given** the backend foundation from Story 1.1,
**When** the `lawful_basis_records`, `suppression_entries`, and `audit_log` tables are migrated,
**Then** lawful-basis and opt-out state can be stored per entity and suppression entries can be recorded.

**Given** the audit substrate exists,
**When** any system or user action occurs (e.g., a source is registered),
**Then** an `audit_log` entry is written capturing actor, action, target, and timestamp, and source provenance (provider, origin) is recorded.

**Given** a reusable audit/provenance logging helper,
**When** later stories perform writes,
**Then** they record audit and provenance through this helper (NFR4, NFR8).

**And given** the requirement to support deletion of regulated personal data (NFR8),
**When** an entity's personal data is requested for erasure,
**Then** the substrate supports deleting that personal data while recording the erasure in the `audit_log`.

**And** no outbound/outreach gating is implemented here — only the substrate (gate activation is Epic 6).

### Story 1.3: Continuous Scheduling & Event Skeleton

As an operator,
I want each enabled source to be checked automatically on its cadence,
So that ingestion runs continuously without manual triggering and one failing source never blocks others.

**Acceptance Criteria:**

**Given** a registered, enabled source with a cadence,
**When** the EventBridge Scheduler + EventBridge + SQS wiring is provisioned,
**Then** the source emits a scheduled "check" event onto the queue on its cadence, and a Go source-adapter interface (with a no-op stub implementation) consumes the event and writes a `source_adapter_runs` record.

**Given** multiple sources are scheduled,
**When** one source's adapter run fails,
**Then** the failure is isolated (logged, failure count incremented) and other sources continue to be checked (NFR9).

**Given** a scheduled check runs,
**When** it completes,
**Then** `source_fetch_state` records the last-checked timestamp and the attempt is logged.

**And given** a transient adapter-run failure,
**When** it occurs,
**Then** the run is retried with basic backoff so early epics have a minimal resilience net (full dead-letter queues and dashboards are added in Story 8.2) (NFR9).

**And** no real source content is fetched in this story (the adapter is a stub) — only the scheduling/queue/adapter-run plumbing.

### Story 1.4: RSS Adapter with Idempotent Dedupe

As an operator,
I want a real RSS source to be fetched and its items stored without duplicates,
So that repeated checks of the same feed never create duplicate records.

**Acceptance Criteria:**

**Given** the scheduling skeleton from Story 1.3 and the `artifacts` table migrated,
**When** the RSS Go adapter runs for an enabled RSS source,
**Then** it fetches the feed, normalizes each item's metadata, fingerprints the payload, and persists new items as `artifacts` linked to the source.

**Given** an RSS item has already been ingested,
**When** the same feed is re-fetched,
**Then** the per-source dedupe key (feed GUID + canonical URL) prevents any new `artifact` row from being created (NFR2, FR19).

**Given** a fetch occurs,
**When** items are processed,
**Then** each fetch attempt and its provenance are recorded via the audit/provenance helper from Story 1.2.

**And** structured events are normalized with entity reference, title, summary, source type + URL, published timestamp, and detected timestamp (FR18).

### Story 1.5: Hot-Path Detector → Signal Candidate

As the engine,
I want a fast, cheap relevance check that flags promising items in seconds,
So that expensive analysis only runs for items worth it.

**Acceptance Criteria:**

**Given** the `signal_candidates` table is migrated and new `artifacts` exist,
**When** the hot-path detector processes an artifact,
**Then** it normalizes and matches title/URL/description/keywords without any LLM, embedding, or transcription call, and completes in seconds (NFR3).

**Given** a match is strong enough,
**When** the detector evaluates relevance,
**Then** it creates a `signal_candidate` and enqueues a cold-path job for that candidate.

**Given** a match is weak,
**When** the detector evaluates relevance,
**Then** no cold-path job is enqueued and no candidate is promoted.

**And** the hot path emits no expensive provider calls (NFR3 enforced and asserted in tests).

### Story 1.6: Cold-Path Enrichment with Evidence (Swappable Provider)

As the engine,
I want relevant candidates analyzed into a final signal with linked evidence,
So that every signal is backed by verifiable source evidence.

**Acceptance Criteria:**

**Given** a cold-path job for a `signal_candidate` and the `signals` + `signal_evidence` tables migrated,
**When** the Step Functions cold path runs,
**Then** it stores the raw artifact in S3, calls the enrichment provider through a Nebius-compatible contract (with a swappable stub implementation usable without live keys), and produces structured JSON with evidence spans.

**Given** the `signal_evidence` schema,
**When** evidence rows are written,
**Then** they store source_url, source_type, source_id, artifact_id, observed_at, published_at, matched_rule_id/watchlist_id, excerpt, diff, structured_evidence_json, confidence, urgency, recommended_action, and raw_artifact_pointer, and the schema accommodates all 11 signal types.

**Given** enrichment produces a signal with no evidence,
**When** the cold path attempts to materialize it,
**Then** the signal is rejected as invalid output (NFR1, FR14).

**Given** any provider call is made,
**When** the cold path runs,
**Then** the call is logged with cost category for later budgeting (NFR5).

### Story 1.7: Dashboard Shell & First Real Signal

As a sales user,
I want to see the first real, evidence-backed signal in the dashboard,
So that I am looking at trustworthy source-backed data instead of fabricated mock data.

**Acceptance Criteria:**

**Given** real signals with evidence exist in RDS,
**When** the API exposes a signals + evidence endpoint and the dashboard fetches it,
**Then** the dashboard renders at least one real evidence-backed signal sourced from RDS, replacing mock data for that slice.

**Given** the existing UI prototype,
**When** the dashboard shell is established,
**Then** Clerk auth is mounted conditionally (default `dev-bypass`, not hard-required) and the app builds and runs (NFR13).

**Given** both views duplicate UI helpers today,
**When** the shared-UI layer is created,
**Then** `NotificationIcon`, `urgencyVariant`, a Radix `Dialog` wrapper, and badge variants live in a single reusable module consumed by the dashboard.

**And** evidence links rendered on the signal are visible and clickable, opening in a new tab (UX-DR5).

**And given** the two primary modes,
**When** the dashboard shell renders,
**Then** it owns the switch between Lead Generation and Monitoring with the active mode always visually obvious, sharing navigation while keeping the two intents distinct (UX-DR1, NFR10).

**And given** parallel UI development (Epics 2 and 3),
**When** the API layer is exposed,
**Then** it has a documented, typed/versioned contract (e.g., OpenAPI or a shared typed client) so consumers depend on a stable data shape and the parallel epics do not diverge.

### Story 1.8: Test Harness, CI & Deployment Pipeline

As a developer,
I want a test framework, CI pipeline, and deployment configured,
So that every subsequent story ships with tests and the dashboard deploys reliably.

> **Sequencing note:** Although numbered last for readability, this story should be implemented at the **start** of Epic 1 so that Stories 1.1–1.7 (and all later epics) are built with tests from the outset. It addresses the Additional Requirement that tests/CI/Vercel are greenfield and must be planned explicitly.

**Acceptance Criteria:**

**Given** the repository has no test framework today,
**When** a test harness is added,
**Then** unit and integration tests can be written and run for both the frontend (`app/`) and the backend/database packages, with a documented `npm`/CI command to run them.

**Given** the test harness exists,
**When** the CI pipeline is configured,
**Then** CI runs lint, build, and tests on each change and fails the pipeline on any failure.

**Given** the dashboard targets Vercel (NFR14),
**When** deployment is configured,
**Then** the Next.js app deploys to Vercel from the main branch with the required environment variables documented (auth defaults to `dev-bypass`).

**And** the "testable" acceptance criteria across all other stories are runnable against this harness.

## Epic 2: Lead Generation & ICP Discovery

Users define ICP rules and receive scored, evidence-backed leads in a discovery inbox with filters and a lead workspace, powered by the hot/cold engine from Epic 1. Includes lead scoring and the legacy UI consolidation, replacing the `leads[]` mock with real API-backed data within this epic.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR20 (lead scoring) · **NFR anchors:** NFR10 · **UX:** UX-DR1, UX-DR2, UX-DR3, UX-DR5, UX-DR6, UX-DR7

### Story 2.1: Legacy UI Consolidation

As a developer,
I want the duplicated UI helpers and hand-rolled modals replaced with the shared-UI layer,
So that the discovery and monitoring views stay visually consistent and the technical debt does not deepen as features grow.

**Acceptance Criteria:**

**Given** `NotificationIcon` and `urgencyVariant` are duplicated across both view files,
**When** the legacy views are refactored,
**Then** both consume the single shared-UI module created in Epic 1, and the duplicate definitions are removed.

**Given** modals are currently hand-rolled fixed-overlay `div`s,
**When** the views are refactored,
**Then** they use the shared Radix `Dialog` wrapper with consistent click-outside and Escape handling.

**Given** the brand theme and component primitives,
**When** UI is composed,
**Then** classNames are composed via `cn()` and styling uses CSS variables and shadcn/CVA variants, not string concatenation or hardcoded hex (UX-DR6).

### Story 2.2: ICP Rule Builder

As a sales user,
I want to define an ICP rule with clearly separated discovery intent and notification routing,
So that the engine knows what to discover and where to alert me.

**Acceptance Criteria:**

**Given** the `icp_rules` and `icp_rule_versions` tables are migrated,
**When** I open the New ICP Rule modal,
**Then** it presents a Discovery Intent section (vertical, region, company size, buyer focus, keywords, technologies, funding/job-title/pain triggers) and a separate Notifications section (Resend email address, webhook URL) (FR1, UX-DR3).

**Given** I complete and submit the modal,
**When** the rule is saved,
**Then** an `icp_rule` (with an initial version) persists via the API and a scheduler route is created for the rule.

**Given** I edit an existing rule,
**When** I save changes,
**Then** a new `icp_rule_version` is recorded preserving history.

**And** creating/updating the rule writes an `audit_log` entry via the Epic 1 substrate.

**And given** an invalid notification route (malformed email or webhook URL),
**When** I submit the modal,
**Then** the input is rejected with a clear error and no `icp_rule` is saved in a broken state.

**And given** an existing ICP rule,
**When** I pause, re-activate, or delete it,
**Then** a paused/deleted rule stops generating new lead candidates and its scheduler route is disabled, while only `active` rules are evaluated during discovery (Story 2.3).

### Story 2.3: ICP-Driven Discovery into Lead Candidates

As a sales user,
I want the engine to discover companies and people that match my active ICP rules,
So that new leads appear without manual searching.

**Acceptance Criteria:**

**Given** an active ICP rule and the `lead_candidates` table migrated,
**When** the hot-path detector evaluates ingested artifacts against active ICP rules,
**Then** strong matches create `lead_candidate` rows referencing the matched rule, and weak matches do not.

**Given** a lead candidate is created,
**When** the cold path enriches it,
**Then** the candidate carries at least one `signal_evidence` row (a candidate with no evidence is not surfaced) and a short source-backed reason it matched.

**Given** discovery and monitoring contexts,
**When** lead candidates are produced,
**Then** they are tagged as discovery context and remain distinct from monitoring signals (NFR10).

### Story 2.4: Explainable, Decaying Lead Scoring

As a sales user,
I want each lead to carry an explainable score that decays as signals age,
So that I can triage by genuine, current relevance.

**Acceptance Criteria:**

**Given** the `lead_scores` table is migrated and a lead candidate with evidence exists,
**When** the lead is scored,
**Then** the score is composed of ICP fit, signal strength, signal recency, contact quality, urgency, and negative/suppression factors, each component inspectable (FR20).

**Given** time passes without new signals,
**When** the score is recomputed,
**Then** the score decays so stale leads stop ranking artificially high.

**Given** a lead's company or contact is suppressed,
**When** the score is computed,
**Then** the suppression factor reduces or removes the lead from active ranking.

> **Implementation note:** The time-decay mechanism is shared with account scoring (Story 3.6) — implement it as a single reusable component so lead and account scoring do not diverge.

### Story 2.5: Discovery Inbox

As a sales user,
I want a discovery inbox of scored leads,
So that I can quickly scan and select the most promising companies.

**Acceptance Criteria:**

**Given** real scored lead candidates exist in RDS,
**When** the discovery inbox loads,
**Then** it fetches leads from the API (the `leads[]` mock array is removed) and shows counts of visible and matching leads.

**Given** the inbox renders,
**When** leads are displayed,
**Then** each card shows company name, segment/vertical, urgency, fit score, notification-routing icons (email + webhook), and a short source-backed reason, with a max of 5 visible cards, scroll, pagination controls, and a selected-lead state (FR3, UX-DR2).

**Given** the inbox is part of Lead Generation,
**When** it is shown,
**Then** it reads as broad, triage-focused discovery and is visually distinct from Monitoring (NFR10).

**And given** no leads match,
**When** the inbox loads,
**Then** a clear empty-state is shown (not an error or blank screen).

### Story 2.6: Discovery Filters Modal

As a sales user,
I want to filter the discovery inbox along the same dimensions as my ICP rule,
So that I can narrow the leads I focus on without changing ingestion.

**Acceptance Criteria:**

**Given** the discovery inbox,
**When** I click the top `Filters` button,
**Then** a filters modal opens (not embedded in the inbox) with minimum fit score, vertical, region, company size, and buyer focus, plus reset and apply actions (FR4, UX-DR3).

**Given** I apply filters,
**When** the inbox updates,
**Then** only local query state changes and no ingestion side effect occurs.

**Given** I reset filters,
**When** I confirm,
**Then** the inbox returns to the unfiltered set.

### Story 2.7: Lead Workspace — Evidence, Contacts & Triage Actions

As a sales user,
I want a workspace for the selected lead showing why it matters and who to contact,
So that I can understand and triage the lead from evidence.

**Acceptance Criteria:**

**Given** a selected lead and the `lead_contacts` table migrated,
**When** the lead workspace renders,
**Then** it shows the selected company header, notification-routing icons, a "What Happened" summary, key signals, an evidence timeline, and enriched contacts (FR5).

**Given** evidence items in the timeline,
**When** I view them,
**Then** each evidence link is visible and clickable and opens in a new tab (UX-DR5).

**Given** triage actions self-contained within this epic,
**When** I choose "Suppress" or "Mark as Qualified",
**Then** Suppress creates a `suppression_entry` (via the Epic 1 substrate) and hides future matches, and Mark as Qualified updates the lead status — each writing an `audit_log` entry.

**And** "Add to Watchlist" is delivered in Epic 3 and "Push to CRM" / "Start Outreach" in Epic 6 — their buttons may be present but their backend activation is out of scope for this epic.

## Epic 3: Account Monitoring & Intelligence Hub

Users add companies and people to a watchlist and get continuous source checks, an account timeline, the "Last 3 Hours / what changed" breakdown, person detail with linking, and account-specific scoring. The closing story promotes a discovered lead into Monitoring with traceability, without duplicating the "lead queue" concept. Replaces the `accounts[]` mock with real API-backed data within this epic.

**FRs covered:** FR6, FR7, FR8, FR9, FR10, FR11, FR12 (closing), FR13, FR20 (account scoring) · **NFR anchors:** NFR10, NFR11, NFR15 · **UX:** UX-DR4, UX-DR5, UX-DR6, UX-DR8

### Story 3.1: Add Monitored Company & Person

As a sales user,
I want to add a company or a person to my watchlist,
So that the engine starts tracking the accounts and decision-makers I care about.

**Acceptance Criteria:**

**Given** the `accounts`, `watchlists`, `watchlist_accounts`, and a shared `persons` table are migrated,
**When** I add a monitored company,
**Then** I can save it with company name (required), domain (optional), and account type/status (optional), and it appears in the watchlist with an initially empty detail view and a status of active or paused (FR6).

**Given** I add a monitored person,
**When** I save it with full name (required) and optional title, company, and public-profile URL,
**Then** the person appears in the monitoring list and uses the single shared Person model (the same entity used in Lead Generation) (NFR11).

**And** creating an entity writes an `audit_log` entry recording entity creation via the Epic 1 substrate.

### Story 3.2: Watchlist View

As a sales user,
I want a watchlist showing all my monitored entities at a glance,
So that I can scan what needs attention and open the right account.

**Acceptance Criteria:**

**Given** real monitored entities exist in RDS,
**When** the watchlist loads,
**Then** it fetches accounts from the API (the `accounts[]` mock array is removed) and shows counts of visible and total accounts.

**Given** the watchlist renders,
**When** entities are displayed,
**Then** each card/row shows name, type (Company/Person), tier, latest-signal time, source count, urgency, signal-strength score, a group/tag column (populated once Epic 7 adds tagging), and notification-routing icons, with a max of 5 visible cards, scroll, pagination/lazy loading, a selected state, and default sort by latest signal or urgency (FR7, UX-DR4).

**Given** the watchlist is part of Monitoring,
**When** it is shown,
**Then** it reads as deep and account-focused, visually distinct from Lead Generation, with no duplicated "lead queue" concept (NFR10, UX-DR8).

### Story 3.3: Per-Account Source Registry & Custom Sources

As a sales user,
I want each monitored account to have its own sources that are checked on a schedule,
So that updates about that account are collected continuously.

**Acceptance Criteria:**

**Given** the `account_source_registry` and `account_notification_routes` tables are migrated,
**When** I create an account via the Add Account modal (name, tier, source list, Resend email + webhook routing),
**Then** the system creates the account record, source-registry entries, notification routes, and scheduler entries (FR13, UX-DR4).

**Given** an existing monitored account,
**When** I use "Add Custom Source",
**Then** a new source is created against the account and its first fetch runs immediately.

**Given** I want fresh data now,
**When** I click "Refresh Now",
**Then** immediate source-check events are enqueued for that account's sources, reusing the Epic 1 scheduling/queue plumbing with failure isolation (NFR9).

**And given** an invalid account field (empty name or malformed email/webhook),
**When** I submit the Add Account modal,
**Then** the input is rejected with a clear error and no partial account/source/route records are persisted.

### Story 3.4: Account Timeline

As a sales user,
I want a chronological timeline of what happened for an account,
So that I can review its recent activity in context.

**Acceptance Criteria:**

**Given** the `account_timeline_events` table is migrated and an account has signals,
**When** the timeline renders,
**Then** events are sorted most-recent-first and each event shows title, summary, source, timestamp, and urgency (FR10).

**Given** the timeline,
**When** I apply a time-window filter,
**Then** I can scope to 24h / 7d / 30d / 90d / 6m, with consistent timezone handling (NFR15).

**Given** deduplicated ingestion from Epic 1,
**When** the timeline renders,
**Then** no duplicate events are displayed, and each event's source link is clickable and opens in a new tab with graceful handling of broken links (UX-DR5).

**And given** an account with no events in the selected window,
**When** the timeline renders,
**Then** a clear empty-state is shown for that window without error.

### Story 3.5: Account Intelligence Hub & "Last 3 Hours" Breakdown

As a sales user,
I want a per-account hub that summarizes what changed recently,
So that I can prepare for an interaction quickly.

**Acceptance Criteria:**

**Given** the `monitoring_summaries` table is migrated and an account has timeline events,
**When** the account intelligence hub renders,
**Then** it shows the selected account header, routing icons, a "Last 3 Hours / what changed" evidence-backed breakdown, the evidence timeline, alert rules, custom sources, and next-best-actions inside the same hub (FR8).

**Given** the summary cadence,
**When** it is configured,
**Then** the breakdown is generated on a cadence configurable per account and per source, defaulting to a 3-hour digest (FR9).

**Given** the breakdown,
**When** it is produced,
**Then** every item references at least one piece of source evidence (NFR1), and the "Create Task" / "Draft Email" actions are displayed but their backend activation is delivered in Epic 6.

### Story 3.6: Account-Specific Decaying Scoring

As a sales user,
I want each monitored account to carry an account-specific score that decays,
So that accounts with fresh, relevant activity surface above stale ones.

**Acceptance Criteria:**

**Given** the account scoring fields/`signal_scores` are migrated and an account has signals,
**When** the account is scored,
**Then** the score is composed of urgency, novelty, relevance to offering, account tier, actionability, and confidence, each component inspectable (FR20).

**Given** time passes without new signals,
**When** the score is recomputed,
**Then** it decays so stale accounts do not stay artificially hot.

**Given** the account score,
**When** the watchlist renders,
**Then** the signal-strength score and urgency shown on each card reflect the current decayed score.

> **Implementation note:** Reuse the shared time-decay component introduced for lead scoring (Story 2.4); account scoring differs only in its component factors, not in the decay mechanism.

### Story 3.7: Person Detail & Person↔Company Linking

As a sales user,
I want to view a monitored person and navigate between them and their company,
So that I can track decision-makers in the context of their organization.

**Acceptance Criteria:**

**Given** a monitored person,
**When** the person detail page renders,
**Then** it shows name, title, linked company, latest signal, a person timeline, and a profile link (visible when available, with a proper fallback when missing) (FR11).

**Given** a person and a company,
**When** I link them,
**Then** the company view shows related people and navigation works in both directions between person and company.

**Given** a person is linked to a company,
**When** configured,
**Then** person events optionally appear in the company timeline, while the shared single Person model is preserved (NFR11).

### Story 3.8: Promote Lead to Watchlist

As a sales user,
I want to promote a discovered lead into Monitoring carrying its history forward,
So that a promising lead becomes a continuously monitored account without losing context.

**Acceptance Criteria:**

**Given** a discovered lead from Epic 2 and the monitoring infrastructure from this epic,
**When** I click "Add to Watchlist" on the lead,
**Then** a `watchlist_account` is created, the lead's existing signals/evidence are copied into the account timeline, and the monitoring schedule starts (FR12).

**Given** the promoted account,
**When** I view it,
**Then** it preserves traceability to the originating ICP rule/lead (the account shows where it came from).

**Given** the promote flow,
**When** the account is created,
**Then** no duplicate "lead queue" concept is created inside Monitoring, and Monitoring reads as account actions rather than rediscovery (NFR10, UX-DR8).

**And** the promote action writes an `audit_log` entry.

**And given** a lead that has already been promoted, **when** I promote it again, **then** the action links to the existing `watchlist_account` and does not create a duplicate (NFR2).

## Epic 4: Expanded Source Coverage — Social, Multimedia & ATS Signals

Signals from the source types users actually care about — job boards, YouTube/podcasts, and protected/social pages — start appearing as evidence, all flowing into the same artifact/signal/evidence tables built in Epic 1. Adds full structured feeds/APIs, managed extraction, multimedia transcription, and source auto-discovery, honoring the fixed collection priority and the compliance substrate.

**FRs covered:** FR15 (full three-pillar), FR16 (auto-discovery) · **NFR anchors:** NFR7, NFR8

### Story 4.1: Structured Feed & API Adapters (YouTube, Greenhouse, Lever)

As a sales user,
I want signals from job boards and video channels,
So that hiring and content signals from reliable structured sources feed my leads and accounts.

**Acceptance Criteria:**

**Given** the `source_credentials` table is migrated and the Epic 1 adapter interface,
**When** YouTube uploads/Data API, Greenhouse, and Lever adapters run for configured sources,
**Then** their items land in the same `artifacts` table and flow through the existing hot/cold pipeline into signals and evidence (FR15).

**Given** the fixed collection priority,
**When** a source has an official API or feed,
**Then** it is preferred over managed extraction (NFR7).

**Given** per-source-type dedupe,
**When** items are ingested,
**Then** YouTube uses video ID and Greenhouse/Lever use ATS job ID so repeated checks create no duplicates (NFR2).

**And** each provider call is logged with its cost category (NFR5) and runs only when that source is configured.

**And given** a provider returns a rate-limit/quota-exceeded error,
**When** the adapter run handles it,
**Then** the source is marked degraded and retried with backoff rather than failing permanently, without blocking other sources (NFR9). _(This rate-limit/quota handling pattern applies to all adapters in Epic 4.)_

### Story 4.2: Conditional HTTP & Firecrawl Web Extraction

As a sales user,
I want normal web pages and blogs monitored efficiently,
So that page changes become signals without unnecessary cost.

**Acceptance Criteria:**

**Given** a generic web-page source,
**When** it is checked,
**Then** a conditional HTTP fetch (ETag / Last-Modified) is attempted first and only changed content proceeds, ahead of any managed extraction (NFR7).

**Given** a page needs rendering, sitemap discovery, or structured extraction,
**When** conditional fetch is insufficient,
**Then** the Firecrawl adapter extracts text/markdown/structured JSON and stores the artifact and snapshot.

**Given** generic-page dedupe,
**When** content is ingested,
**Then** the dedupe key (normalized URL + ETag/Last-Modified + content hash) prevents duplicates (NFR2).

**And** Firecrawl calls are logged with cost category and run only when configured (NFR5).

### Story 4.3: Bright Data Social & Protected Extraction

As a sales user,
I want signals from LinkedIn/social and anti-bot-protected pages,
So that high-value social and protected sources contribute evidence — captured lawfully.

**Acceptance Criteria:**

**Given** a protected/social source,
**When** Firecrawl is blocked or the target is LinkedIn/Xing/social,
**Then** the Bright Data adapter performs managed extraction (no user-owned personal-login automation) and lands results in the same `artifacts` tables (NFR8, NFR7).

**Given** social personal data is regulated,
**When** it is captured,
**Then** only necessary public business context is stored, provider provenance is logged, and lawful-basis/suppression state (Epic 1 substrate) is recorded so the data supports suppression and deletion (NFR8).

**Given** social dedupe,
**When** items are ingested,
**Then** the provider record ID + profile/company/post URL + observed timestamp bucket prevents duplicates (NFR2).

### Story 4.4: WebShare Proxy & Custom Adapter Fallback

As an operator,
I want a low-cost proxy path for custom adapters,
So that sources with no API or managed coverage can still be collected as a last resort.

**Acceptance Criteria:**

**Given** a source not served by official API, feed, Firecrawl, or Bright Data,
**When** a custom Go adapter runs,
**Then** it routes through WebShare rotating proxies as the lowest-priority collection method (NFR7).

**Given** a custom adapter fetch,
**When** it completes,
**Then** results land in the same `artifacts` tables, are deduped by content fingerprint, and proxy/extraction provider and cost category are recorded (NFR2, NFR5).

### Story 4.5: Multimedia Intelligence Pipeline

As a sales user,
I want spoken content from podcasts and videos turned into searchable evidence,
So that sales signals buried in audio/video are not missed.

**Acceptance Criteria:**

**Given** the `transcripts` and `transcript_chunks` tables are migrated,
**When** a multimedia item passes the hot-path relevance check,
**Then** the cold path downloads the media to S3, transcribes it, chunks the transcript, and runs Nebius structured analysis to extract signals and evidence (FR15).

**Given** the cost discipline,
**When** multimedia is processed,
**Then** transcription/LLM runs only after relevance is confirmed (NFR3) and each call is logged with cost category (NFR5).

**Given** transcript dedupe,
**When** chunks are stored,
**Then** the dedupe key (transcript ID + chunk index + content hash) prevents duplicate chunks (NFR2).

**And** multimedia-derived signals become searchable evidence indistinguishable in structure from other source types (FR15).

### Story 4.6: Source Auto-Discovery from Company Domain

As a sales user,
I want the engine to suggest and register obvious sources for a company,
So that I do not have to find every feed and page myself.

**Acceptance Criteria:**

**Given** a company domain,
**When** auto-discovery runs,
**Then** it identifies obvious sources (domain/sitemap, RSS/newsroom/blog, careers/ATS page, YouTube channel) and registers them in the source registry with appropriate adapter types and cadences (FR16).

**Given** auto-discovered sources,
**When** they are registered,
**Then** scheduled checks begin automatically and each carries a dedupe-key strategy and provider/cost metadata (NFR2, NFR5).

**Given** a discovered source already exists for the entity,
**When** auto-discovery runs again,
**Then** it does not create a duplicate source registration.

## Epic 5: Hybrid Search Across Pillars

Users search across evidence, signals, contacts, and summaries with hybrid retrieval (Postgres lexical + Pinecone semantic + Cohere rerank), scoped by metadata filters that preserve discovery-vs-monitoring context.

**FRs covered:** FR21 · **NFR anchors:** NFR10

### Story 5.1: Lexical Search & Context-Preserving Filters

As a sales user,
I want exact search with metadata filters,
So that I can find specific accounts, sources, and evidence reliably.

**Acceptance Criteria:**

**Given** signals, evidence, contacts, and summaries exist in RDS,
**When** I run a lexical query,
**Then** Postgres full-text search returns matching results across those record types.

**Given** the metadata filters,
**When** I scope a query,
**Then** I can filter by discovery vs monitoring, source type, account, ICP rule, watchlist, geography, buyer role, and time window (FR21).

**Given** the context-separation rule,
**When** results are returned,
**Then** discovery and monitoring results remain distinct and are never silently merged (NFR10).

### Story 5.2: Semantic Retrieval via Pinecone

As a sales user,
I want meaning-based search,
So that I can find relevant evidence even when wording differs.

**Acceptance Criteria:**

**Given** artifacts, evidence, transcripts, summaries, and account timelines,
**When** they are indexed,
**Then** Cohere embeddings are upserted into Pinecone with metadata mirroring the lexical filter dimensions.

**Given** a natural-language query,
**When** semantic search runs,
**Then** Pinecone returns semantically relevant items scoped by the same metadata filters (FR21).

**Given** new or updated records,
**When** they are materialized,
**Then** their vectors are upserted so the semantic index stays current.

### Story 5.3: Cohere Reranking & Unified Hybrid Results

As a sales user,
I want the best results first regardless of how they were found,
So that I can trust the top of the list.

**Acceptance Criteria:**

**Given** lexical results from Story 5.1 and semantic results from Story 5.2,
**When** a hybrid query runs,
**Then** results are merged and reordered by Cohere rerank into a single relevance-ranked list (FR21).

**Given** the merged list,
**When** it is returned,
**Then** the active metadata filters and discovery-vs-monitoring context are still enforced (NFR10).

**Given** a query with no results,
**When** it runs,
**Then** an empty-state response is returned without error.

### Story 5.4: Cross-Pillar Search UI

As a sales user,
I want a search experience over both pillars,
So that I can quickly jump to the right account, lead, contact, or evidence.

**Acceptance Criteria:**

**Given** the hybrid search backend,
**When** I search from the UI,
**Then** I can query across evidence, signals, contacts, and summaries, including by company or person name with partial matching.

**Given** a search result,
**When** I select it,
**Then** it opens the corresponding detail view (lead workspace or account/person hub).

**Given** the two pillars,
**When** results are displayed,
**Then** discovery and monitoring results are visually distinguished so context is never ambiguous (NFR10).

## Epic 6: Activation & Compliance Gate

Users move from insight to action — Start Outreach, Push/Log to CRM, Create Task, Draft Email — with notifications routed to Resend email + webhook, and every outbound action gated by an active suppression / lawful-basis / opt-out check and recorded in the audit log.

**FRs covered:** FR22, FR23, FR24 (gate activation) · **NFR anchors:** NFR4

### Story 6.1: Suppression & Lawful-Basis Gate

As a compliance officer,
I want every outbound action checked against suppression and lawful-basis state,
So that the product never contacts a suppressed or opted-out entity.

**Acceptance Criteria:**

**Given** the Epic 1 compliance substrate and a reusable gate check,
**When** any outbound action is attempted,
**Then** a suppression check runs first and a suppressed company/contact is blocked from outreach routing (FR24, NFR4).

**Given** lawful-basis and opt-out state per entity,
**When** an action targets that entity,
**Then** the action is permitted only if lawful basis exists and the entity has not opted out, otherwise it is blocked with a clear reason.

**Given** any gate decision,
**When** it is made,
**Then** the decision (allowed/blocked + reason) is recorded in the `audit_log`.

**And given** an entity with no lawful-basis record at all, **when** an outbound action targets it, **then** the action is blocked by default (fail-closed), not allowed (NFR4).

### Story 6.2: Notification Routing & Alert Delivery

As a sales user,
I want urgent matches delivered to my email and webhook,
So that I am alerted to high-value signals without watching the dashboard.

**Acceptance Criteria:**

**Given** the `alert_destinations`, `alert_deliveries`, and `notification_routes` tables are migrated,
**When** notification routing is configured per ICP rule and per monitored account,
**Then** a Resend email address and a webhook URL can be registered as routes (FR23).

**Given** a high-confidence/urgent match,
**When** it occurs,
**Then** an alert is delivered to the configured Resend email and webhook and recorded as an `alert_delivery` (FR23).

**Given** a delivery failure,
**When** it happens,
**Then** the failure is recorded and retried per the resilience policy without blocking other deliveries (NFR9).

### Story 6.3: Outreach & Email Drafting

As a sales user,
I want to start outreach and draft emails tied to the evidence,
So that I can act on a lead or account with traceable, compliant communication.

**Acceptance Criteria:**

**Given** the `outreach_events` table is migrated and a selected lead/account,
**When** I click "Draft Email",
**Then** a Resend-ready draft is generated/editable and references the originating evidence.

**Given** I click "Start Outreach",
**When** the action runs,
**Then** the gate from Story 6.1 is checked first, and on pass an `outreach_event` is created tied to the originating evidence and triggers Resend/n8n (FR22).

**Given** a suppressed/opted-out target,
**When** I attempt outreach,
**Then** the action is blocked by the gate and no `outreach_event` is emitted.

### Story 6.4: CRM Activation & Task Creation

As a sales user,
I want to push leads/accounts to CRM, log notes, and create tasks,
So that my downstream sales workflow stays in sync — one way, traceable to evidence.

**Acceptance Criteria:**

**Given** the `crm_links` table is migrated,
**When** I click "Push to CRM" or "Log in CRM",
**Then** a one-way CRM sync / note-or-opportunity event is emitted via n8n/Lambda playbooks, tied to the originating evidence (FR22), with no bidirectional sync (per V1 non-goals).

**Given** I click "Create Task",
**When** the action runs,
**Then** a CRM/n8n task event is emitted and tied to the originating evidence (FR22).

**Given** any CRM/task action,
**When** it runs,
**Then** the gate from Story 6.1 is checked first and the action is recorded in the `audit_log`, keeping every outbound action traceable and auditable (FR24, NFR4).

## Epic 7: Collaboration & Export

Teams organize and extract their work: groups/tags on monitored entities, follow-up reminders without a CRM dependency, ownership with an activity log, and a one-way CSV export that respects active filters and suppression/opt-out state.

**FRs covered:** FR25, FR26, FR27, FR28

### Story 7.1: Groups & Tags

As a sales user,
I want to tag and group monitored entities,
So that I can organize and filter my watchlist by my own categories.

**Acceptance Criteria:**

**Given** the `tags`/entity-tag tables are migrated,
**When** I assign one or more tags/groups to an entity,
**Then** the entity can carry multiple tags and they are visible in both the list and detail views (FR25).

**Given** tagged entities,
**When** I filter the watchlist by tag/group,
**Then** only matching entities are shown, and the group/tag column from the watchlist view (Story 3.2) is populated.

### Story 7.2: Follow-up Reminders

As a sales user,
I want to set follow-up reminders on an entity,
So that I track outreach timing without needing a CRM.

**Acceptance Criteria:**

**Given** the `reminders` table is migrated,
**When** I create a reminder with a title, date/time, and optional note,
**Then** it is saved against the entity with no CRM connection required (FR26).

**Given** reminders on an entity,
**When** I view the entity detail,
**Then** the reminders are displayed and overdue reminders are highlighted (FR26).

**And** creating a reminder writes an entry consumable by the activity log (Story 7.3).

### Story 7.3: Ownership & Activity Log

As a sales user on a team,
I want clear ownership and a history of key actions per entity,
So that we avoid stepping on each other and can see what happened.

**Acceptance Criteria:**

**Given** an owner field on entities and the `activity_log`,
**When** I claim or am assigned an entity,
**Then** the entity has a visible owner that can be claimed/assigned (FR27).

**Given** key actions on an entity,
**When** they occur,
**Then** the activity log records entity creation, owner changes, reminder creation, and status changes, visible in the detail view (FR27).

### Story 7.4: One-Way CSV Export

As a sales user,
I want to export my monitored entities to CSV,
So that I can use the data in external tools.

**Acceptance Criteria:**

**Given** a filtered watchlist,
**When** I export to CSV,
**Then** the file includes name, type, latest signal, urgency, timestamp, and optional source links, and respects the active filters (FR28).

**Given** the export is one-way,
**When** it runs,
**Then** no data is imported back and the export honors suppression/opt-out state (suppressed entities/contacts are not leaked into the export).

**Given** a large filtered set,
**When** export runs,
**Then** the CSV is produced without partial/corrupt output.

**And given** an empty filtered set,
**When** I export,
**Then** a valid CSV containing only the header row is produced without error.

## Epic 8: Reliability, Cost & Governance Hardening

Operators can trust the system runs within budget and recovers from failures: observability dashboards, dead-letter queues, cost counters and spend dashboards, retry/backoff policies, and source-health state. Builds operational visualization on the base cost/provenance logging from Epic 1.

**FRs covered:** — (NFR-driven) · **NFR anchors:** NFR5 (dashboards), NFR9, NFR12

### Story 8.1: Observability Dashboards

As an operator,
I want dashboards for system health,
So that I can see adapter errors, processing failures, latency, and provider usage at a glance.

**Acceptance Criteria:**

**Given** the system emits logs and metrics,
**When** CloudWatch dashboards are provisioned,
**Then** they show adapter errors, cold-path failures, latency, and provider usage (NFR12).

**Given** an abnormal condition (error spike, latency breach),
**When** thresholds are crossed,
**Then** an alarm fires to the configured operator channel.

### Story 8.2: Dead-Letter Queues & Retry Policies

As an operator,
I want failed jobs isolated and retried sensibly,
So that transient failures recover and poison messages do not block the system.

**Acceptance Criteria:**

**Given** ingestion and processing queues,
**When** a job fails repeatedly,
**Then** it is routed to a dead-letter queue after the configured retry attempts (NFR9).

**Given** a transient failure,
**When** a job is retried,
**Then** retries use backoff and one failed source/job never blocks others (NFR9).

**Given** items in a dead-letter queue,
**When** an operator inspects them,
**Then** the failure context is available for diagnosis and manual replay.

### Story 8.3: Cost Counters & Spend Dashboards

As an operator,
I want per-provider spend visibility,
So that I can keep provider costs within budget.

**Acceptance Criteria:**

**Given** the per-call cost logging from Epic 1,
**When** cost counters are aggregated,
**Then** spend is tracked per provider (Firecrawl, Bright Data, Nebius, Cohere, Pinecone, transcription) and surfaced on a spend dashboard (NFR5).

**Given** the spend dashboard,
**When** a provider's usage approaches a budget threshold,
**Then** the threshold is visible and can raise an alert.

**Given** processing volume,
**When** costs are reported,
**Then** processing cost per artifact is derivable from the counters.

### Story 8.4: Source Health State

As an operator,
I want to see the health of each source,
So that I can fix failing sources before they degrade coverage.

**Acceptance Criteria:**

**Given** source fetch state and failure counts from Epic 1,
**When** source health is computed,
**Then** each source surfaces a health state (healthy / degraded / failing) based on recent failures and last successful fetch (NFR12).

**Given** a failing source,
**When** it crosses a failure threshold,
**Then** it is flagged for operator attention without blocking other sources (NFR9).

**Given** duplicate-suppression metrics,
**When** ingestion runs,
**Then** the duplicate suppression rate is observable to confirm idempotency is working (NFR2).
