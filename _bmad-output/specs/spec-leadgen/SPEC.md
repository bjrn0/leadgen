---
id: SPEC-leadgen
companions:
  - ../../../specs/architecture.md
  - ../../../specs/data-model.md
  - ../../../specs/sources.md
  - ../../../specs/ui-mapping.md
  - ../../../specs/phases.md
  - ../../../specs/LeadGen Monitoring feature.md
sources:
  - ../../../specs/product.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# LeadGen — Go-to-Market Intelligence Engine

## Why

This is a **vision to realize** with a clear **opportunity** behind it: internal sales, business-development, and account-research teams burn time turning scattered public internet signals into sales actions, and have no single place that ties every recommendation back to its evidence. LeadGen is an internal engine that converts public signals into evidence-backed sales actions across two connected pillars — **Lead Generation** (broad, discovery-oriented: find companies and people that match an ICP) and **Account Monitoring** (narrow, deep: track known accounts and summarize what changed). The two share one ingestion-to-evidence pipeline. It exists because the team wants a signal-to-action console, not a generic scraper, and the value lives in the intelligence layer that runs *after* extraction.

## Capabilities

- id: CAP-1
  intent: A user defines an ICP rule (vertical, region, size, buyer focus, keywords, technologies, funding/job-title/pain triggers) and the engine discovers matching companies and decision-makers.
  success: Given an active ICP rule, the discovery inbox returns new companies/prospects each carrying a fit score, urgency, contact path, and a source-backed reason why the lead matters now.

- id: CAP-2
  intent: A user adds a known company or person to a watchlist and the engine continuously tracks its registered sources and summarizes what changed.
  success: A watchlisted entity accumulates timeline events from its sources; its intelligence hub renders a "Last 3 hours" / "what changed" evidence-backed breakdown on a cadence configurable per account and per source (default 3-hour digest), and a person can be linked to a company with navigation between them.

- id: CAP-3
  intent: Every lead, alert, score, and recommendation links back to the source evidence that produced it.
  success: Every final signal has at least one `signal_evidence` row with source_url, timestamps, excerpt, confidence, urgency, and recommended_action; a signal with no evidence is rejected as invalid output.

- id: CAP-4
  intent: A discovered lead can be promoted into Monitoring via "Add to Watchlist", carrying its history forward.
  success: Promoting a lead creates a `watchlist_account`, copies its existing signals/evidence into the account timeline, and starts the monitoring schedule — without creating a duplicate "lead queue" concept inside Monitoring.

- id: CAP-5
  intent: The same ingestion pipeline absorbs structured feeds/APIs, managed web/social extraction, and multimedia transcription.
  success: Every source type (RSS, YouTube, Greenhouse/Lever, Firecrawl pages, Bright Data social, transcribed media) lands in the same artifact/signal/evidence tables, and expensive providers run only when configured for that source.

- id: CAP-6
  intent: Repeated source checks and retries do not create duplicate leads, alerts, or signals.
  success: Re-ingesting identical source content produces no new lead/signal/alert rows, enforced by the per-source-type dedupe keys defined in the data model.

- id: CAP-7
  intent: Leads and monitored accounts are scored with explainable, decaying relevance.
  success: A lead carries an explainable score (ICP fit, signal strength, recency, contact quality, urgency, suppression factors); a monitored account carries an account-specific score (urgency, novelty, relevance, tier, actionability, confidence); both decay over time so stale signals stop keeping an entity artificially hot.

- id: CAP-8
  intent: A user can search across both pillars over evidence, signals, contacts, and summaries while preserving discovery-vs-monitoring context.
  success: A query returns hybrid (lexical + semantic + reranked) results correctly scoped by metadata filters (discovery vs monitoring, source type, account, ICP rule, watchlist, geography, buyer role, time window).

- id: CAP-9
  intent: A user can act on a lead or account (start outreach, push/log to CRM, create task, draft email) and the action is traceable and compliance-gated.
  success: Each action emits a traceable event (`outreach_event`, CRM sync, task) tied to the originating evidence, and any suppressed company/contact is blocked from outreach routing.

- id: CAP-10
  intent: A user routes notifications per ICP rule and per monitored account to email and a webhook.
  success: A high-confidence/urgent match delivers an alert to the configured Resend email address and webhook URL, recorded as an `alert_delivery`.

- id: CAP-11
  intent: Suppression, lawful basis, opt-out, ownership, and audit are first-class product objects, present before any outbound workflow is treated as production-ready.
  success: A suppression check runs before every outbound action; lawful-basis and opt-out state are stored per entity; and every user and system action is recorded in the audit log.

- id: CAP-12
  intent: A user organizes monitored entities with groups/tags and filters by them.
  success: An entity can carry one or more tags/groups, the tag is visible in list and detail views, and the watchlist can be filtered by tag/group.

- id: CAP-13
  intent: A user sets follow-up reminders on a monitored entity without any CRM dependency.
  success: A reminder (title, date/time, optional note) is created and shown in the entity detail, overdue reminders are highlighted, and no CRM connection is required for this to work.

- id: CAP-14
  intent: A user claims or is assigned ownership of an entity, and key actions on it are tracked.
  success: An entity has a visible owner that a user can claim/assign, and an activity log records entity creation, owner changes, reminder creation, and status changes in the detail view.

- id: CAP-15
  intent: A user exports monitored entities for external use.
  success: A one-way CSV export (name, type, latest signal, urgency, timestamp, optional source links) is produced and respects the active filters.

## Constraints

- **Evidence first.** No lead, alert, score, or recommendation may exist without linked source evidence; evidence-less signals are invalid output.
- **Idempotent by default.** All writes are keyed by source-specific dedupe identifiers (see `data-model.md` dedupe table); retries and repeated checks must not duplicate records.
- **Hot path / cold path split.** The hot path must complete in seconds and avoid LLM, embedding, and transcription calls; the expensive cold path runs only for items the hot path judged relevant.
- **Compliance from day one.** Suppression is checked before outreach; lawful-basis metadata and audit trails are core objects, not later add-ons.
- **Cost-aware.** Every Nebius AI Studio, Cohere, Pinecone, Firecrawl, Bright Data, proxy, and transcription call must be logged and budgetable.
- **AWS-native for V1.** RDS Postgres (with pgvector) is the system of record; S3 holds raw artifacts/snapshots/audio/transcripts/LLM JSON; EventBridge Scheduler + EventBridge + SQS + Lambda + Step Functions orchestrate. Pinecone is production vector search; Cohere does rerank/embeddings.
- **Source collection priority is fixed:** Official API → RSS/feed/structured endpoint → conditional HTTP (ETag/Last-Modified) → Firecrawl → Bright Data → custom Go adapter with WebShare proxy.
- **Managed providers for LinkedIn/social only.** No user-owned personal-login automation; social personal data is treated as regulated and audit-sensitive.
- **Failure isolation.** One failed source must never block other sources or the system.
- **Context separation.** Discovery signals and monitoring signals remain distinct everywhere — including search; Monitoring must read as account actions, not rediscovery.
- **One Person entity.** A single Person model is shared across both pillars — a lead-gen decision-maker and a monitored person are the same entity, not parallel models.

## Non-goals

- Not a generic lead scraper, transcript product, or content-repurposing tool.
- No homegrown logged-in social bots / personal-login automation.
- Temporal is not used in V1 (reserved as a future option if workflows outgrow Step Functions).
- **Bidirectional / full CRM sync is out of V1.** CRM *activation* — one-way push and note/opportunity logging (CAP-9) — is in V1; two-way sync and Apollo/API integrations stay as documented future hooks. Data export remains one-way.
- No week-by-week schedule is committed — `phases.md` defines build *order*, not calendar dates.

## Success signal

A sales user defines an ICP and receives scored, evidence-backed leads; adds a target account and receives continuous evidence-backed "what changed" breakdowns; every recommendation surfaces a source URL, timestamp, excerpt, confidence, and action rationale; duplicate signals never appear across retries or repeated checks; and at any moment the dashboard makes it obvious whether the user is discovering new leads or monitoring known accounts.

## Assumptions

- The broad two-pillar vision in `product.md` and the concrete monitoring backlog in `LeadGen Monitoring feature.md` describe the same product at different altitudes; the backlog's features (People monitoring, grouping/tagging, reminders, ownership, CSV export, activity log) are confirmed in scope for V1 (CAP-12–CAP-15), and `product.md` describes the full target state of which V1 is the first realization.
