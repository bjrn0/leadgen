# Data Model

## Core Objects

The schema must preserve the distinction between discovery leads and monitored accounts while sharing sources, artifacts, signals, evidence, contacts, alerts, and outreach history.

## Tables

### Accounts And Watchlists

- `accounts`
- `watchlists`
- `watchlist_accounts`
- `account_source_registry`
- `account_notification_routes`

### Lead Generation

- `icp_rules`
- `icp_rule_versions`
- `lead_candidates`
- `lead_scores`
- `lead_contacts`
- `lead_actions`

### Sources And Artifacts

- `sources`
- `source_fetch_state`
- `source_credentials`
- `source_adapter_runs`
- `artifacts`
- `artifact_snapshots`
- `transcripts`
- `transcript_chunks`

### Signals And Evidence

- `signal_candidates`
- `signals`
- `signal_evidence`
- `signal_scores`
- `account_timeline_events`
- `monitoring_summaries`

### Contacts And Enrichment

- `contacts`
- `contact_enrichment`
- `company_enrichment`
- `crm_links`

### Alerts, Actions, Compliance

- `alert_destinations`
- `alert_deliveries`
- `notification_routes`
- `outreach_events`
- `suppression_entries`
- `lawful_basis_records`
- `audit_log`

## Key Relationships

- An account can be discovered as a lead and later added to one or more watchlists.
- An ICP rule produces many lead candidates.
- A watchlist contains many monitored accounts.
- A monitored account has its own source registry.
- A source produces many artifacts.
- An artifact can produce zero or more signal candidates.
- A candidate can become one final signal after cold-path enrichment.
- Every final signal must have at least one evidence row.
- Contacts can be linked to accounts, lead candidates, CRM records, and outreach events.
- Alerts and actions must point back to the signal evidence that caused them.

## Required Evidence Fields

Every `signal_evidence` row must store:

- `source_url`
- `source_type`
- `source_id`
- `artifact_id`
- `observed_at`
- `published_at`
- `matched_rule_id` or `watchlist_id`
- `excerpt`
- `diff`
- `structured_evidence_json`
- `confidence`
- `urgency`
- `recommended_action`
- `raw_artifact_pointer`

Signals without evidence are invalid product output.

## Dedupe Keys

| Source type | Dedupe key |
| --- | --- |
| RSS/blog feed | feed GUID + canonical URL |
| Podcast episode | RSS GUID + enclosure URL |
| YouTube | video ID |
| Greenhouse/Lever jobs | ATS job ID |
| Generic page | normalized URL + ETag / Last-Modified + content hash |
| Managed extraction | provider record ID + canonical URL + content fingerprint |
| LinkedIn/social | provider record ID + profile/company/post URL + observed timestamp bucket |
| Transcript chunks | transcript ID + chunk index + content hash |

## Signal Types

- `hiring`
- `funding`
- `expansion`
- `partnership`
- `technology_change`
- `executive_change`
- `pain_point`
- `product_launch`
- `compliance_or_regulatory`
- `outsourcing_fit`
- `relationship_signal`

## Scoring

Lead scoring should start simple and explainable:

- ICP fit
- signal strength
- signal recency
- contact quality
- urgency
- negative/suppression factors

Monitoring scoring should be account-specific:

- urgency
- novelty
- relevance to offering
- account tier
- actionability
- confidence

Scores must decay over time so stale signals do not keep accounts artificially hot.

## Search Strategy

- Postgres full-text and filters for exact account, source, status, and evidence queries.
- Pinecone for production semantic search over artifacts, evidence, transcripts, summaries, and account timelines.
- Cohere rerank for final relevance ordering.
- Metadata filters must preserve context: discovery vs monitoring, source type, account, ICP rule, watchlist, geography, buyer role, and time window.

## Compliance Data

The database must support:

- suppression lists
- lawful basis flags
- source provenance
- outreach history
- owner assignment
- opt-out state
- audit log of user and system actions

This is required before CRM activation or outbound workflows are treated as production-ready.
