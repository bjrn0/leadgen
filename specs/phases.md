# Action Plan

This plan intentionally avoids week-by-week scheduling. It defines the order of what must exist for the product to become real.

## 1. Foundation

Build the shared platform pieces before expanding features.

### Required Outcomes

- RDS Postgres schema for accounts, ICP rules, watchlists, sources, artifacts, signals, contacts, alerts, outreach events, suppression, and audit.
- S3 buckets for raw artifacts, snapshots, audio/video, transcripts, and extraction JSON.
- EventBridge Scheduler setup for continuous source checks.
- EventBridge + SQS event routing.
- Step Functions cold-path workflow shell.
- Go adapter interface for source ingestion.
- Next.js + Clerk dashboard shell.
- Resend and webhook notification routes.

### Acceptance Criteria

- A source can be registered and scheduled.
- A fetch run can dedupe repeated content.
- A signal candidate can be created with evidence.
- The dashboard can show dummy or real signal data from RDS.

## 2. Lead Generation Core

Build the discovery workflow around ICP rules.

### Required Outcomes

- ICP rule builder.
- Discovery inbox.
- ICP filters.
- Source adapters for RSS, YouTube metadata, Greenhouse, Lever, and basic site pages.
- Hot-path detector for ICP matches.
- Cold-path enrichment using Nebius AI Studio.
- Scoring for fit, urgency, recency, and contact quality.
- Lead evidence timeline.
- Contacts/enrichment state.
- Actions: Add to Watchlist, Push to CRM, Suppress, Start Outreach.

### Acceptance Criteria

- A user can define an ICP.
- The engine can find and score matching companies.
- Each lead has source-backed evidence.
- A lead can be promoted into Monitoring.

## 3. Account Monitoring Core

Build the watchlist workflow around known target accounts.

### Required Outcomes

- Add Account modal.
- Watchlist left column.
- Per-account source registry.
- Scheduled checks for account sources.
- Last 3 Hours breakdown.
- Evidence timeline.
- Alert rules.
- Custom source management.
- Next best actions inside the account hub.
- Actions: Create Task, Draft Email, Start Outreach, Log in CRM.

### Acceptance Criteria

- A user can add a company to monitoring.
- The engine checks its sources continuously.
- New signals appear in the account timeline.
- The account hub generates a short evidence-backed breakdown.

## 4. Three-Pillar Ingestion Coverage

Expand ingestion without changing the product model.

### Required Outcomes

- Structured feeds/APIs:
  - RSS
  - YouTube
  - Greenhouse
  - Lever
- Managed extraction:
  - Firecrawl adapter
  - Bright Data adapter for LinkedIn/Xing/social/protected pages
  - WebShare proxy support
- Multimedia:
  - media URL detection
  - S3 media storage
  - transcription
  - transcript chunking
  - Nebius structured transcript analysis

### Acceptance Criteria

- Every source type flows into the same artifact/signal/evidence tables.
- Expensive providers are used only when configured.
- Multimedia items become searchable evidence when relevant.

## 5. Search, Scoring, And Activation

Make the engine actionable, not just informative.

### Required Outcomes

- Pinecone semantic retrieval.
- Cohere reranking.
- Postgres lexical search and metadata filtering.
- CRM sync event model.
- Resend email workflow.
- n8n/Lambda activation playbooks.
- Suppression checks before outreach.
- Audit trail for user and system actions.

### Acceptance Criteria

- Search works across leads, monitoring signals, evidence, contacts, and summaries.
- CRM and email actions are traceable to evidence.
- Suppressed accounts/contacts are not routed to outreach.

## 6. Reliability, Cost, And Governance

Prepare the product for real usage.

### Required Outcomes

- CloudWatch dashboards for adapter errors, cold-path failures, latency, and provider usage.
- Dead-letter queues for failed ingestion and processing jobs.
- Cost counters for Firecrawl, Bright Data, Nebius, Cohere, Pinecone, and transcription.
- Retry policies and backoff.
- Source health state.
- Compliance state:
  - lawful basis
  - suppression
  - opt-out
  - outreach audit

### Acceptance Criteria

- Failed sources do not block the system.
- Duplicate events do not create duplicate records.
- Provider spend can be monitored.
- Every outbound action is auditable.

## Build Order Summary

1. Shared data model and AWS event skeleton.
2. Lead Generation UI and ICP-driven discovery.
3. Monitoring UI and account source registry.
4. Structured source adapters.
5. Managed extraction adapters.
6. Multimedia cold path.
7. Search, scoring, and activation.
8. Reliability, cost controls, compliance hardening.

## Metrics To Track

- signal-to-meeting rate
- false-positive rate
- time from source update to signal
- time from signal to user action
- leads promoted to watchlist
- monitoring alerts acted on
- processing cost per artifact
- provider failure rate
- duplicate suppression rate
