# Architecture

## System Shape

LeadGen uses one always-on AWS-native intelligence engine that powers both the Leads tab and Monitoring tab.

```text
RDS source registry + ICP rules + watchlists
  -> EventBridge Scheduler
  -> Go source adapters / managed extraction providers
  -> EventBridge + SQS
  -> hot-path detector
  -> Step Functions cold path
  -> S3 + Nebius AI Studio + Cohere + Pinecone
  -> RDS signals, timelines, contacts, alerts
  -> dashboard + Resend + webhooks + CRM/n8n actions
```

## Runtime Principles

- EventBridge Scheduler keeps the engine alive continuously.
- Every active ICP rule and watchlisted account creates scheduled work.
- Hot path runs first for speed and cost control.
- Cold path runs only for items worth deeper analysis.
- All writes are idempotent and keyed by source-specific dedupe identifiers.
- RDS Postgres is the system of record.
- S3 stores raw artifacts, page snapshots, audio, transcripts, and structured extraction outputs.

## Hot Path

The hot path is the fast lane. It should complete in seconds and avoid expensive LLM, embedding, and transcription calls.

### Input

- New RSS entry.
- New YouTube upload metadata.
- New ATS job record.
- Changed page metadata.
- Managed scraper result metadata.
- Watchlist or ICP scheduled check event.

### Work

- Normalize source metadata.
- Fingerprint payload.
- Dedupe against fetch state.
- Match title, URL, description, keywords, company names, buyer roles, and ICP rules.
- Create `signal_candidate` or provisional lead when the match is strong enough.
- Emit alert event only for high-confidence urgent matches.

### Output

- Candidate signal.
- Provisional lead.
- Immediate low-cost alert.
- Cold-path job if the item is relevant enough.

## Cold Path

The cold path is the deep analysis lane. It runs after hot path relevance checks.

### Work

- Fetch full artifact and store raw content in S3.
- For pages: extract text/markdown/structured JSON through Firecrawl, Bright Data, or direct fetch.
- For multimedia: download media to S3, transcribe, then analyze transcript.
- Call Nebius AI Studio for structured JSON extraction:
  - entities
  - companies
  - people
  - topics
  - pain signals
  - hiring signals
  - expansion signals
  - urgency
  - confidence
  - recommended next action
  - evidence spans
- Embed and rerank with Cohere where semantic retrieval is useful.
- Upsert semantic vectors into Pinecone.
- Score lead/account relevance.
- Materialize final signals, evidence, timelines, summaries, alerts, and actions in RDS.

## Three Ingestion Pillars

### 1. Structured Feeds And APIs

Primary source type because it is reliable, cheap, and easy to dedupe.

- RSS feeds for blogs and podcasts.
- YouTube uploads playlist / YouTube Data API.
- Greenhouse and Lever job board APIs.
- Other official APIs where available.

### 2. Managed Web And Social Extraction

Used when structured sources do not exist or when platforms are protected.

- Firecrawl for normal web pages, sitemaps, rendering, markdown, and extraction.
- Bright Data for protected/high-value targets, LinkedIn, Xing, social profiles, social search, and anti-bot heavy pages.
- WebShare for baseline rotating proxies.

Firecrawl and Bright Data stay at the boundary. The proprietary value is the intelligence layer after extraction.

### 3. Multimedia Intelligence

Used for podcasts, videos, webinars, executive interviews, and other spoken content.

```text
RSS / YouTube metadata
  -> hot-path relevance check
  -> download MP3/video to S3
  -> transcription
  -> Nebius AI Studio structured breakdown
  -> signal extraction + timeline + search
```

Multimedia is cold-path heavy and should only run after relevance checks.

## AWS Services

| Service | Purpose |
| --- | --- |
| RDS Postgres + pgvector | System of record, timeline queries, metadata filters, initial hybrid search |
| S3 | Raw artifacts, page snapshots, audio/video, transcripts, LLM JSON |
| EventBridge Scheduler | Continuous ICP and watchlist polling |
| EventBridge | Event routing between adapters, hot path, cold path, alerts, activations |
| SQS | Queue and retry boundary between hot path and cold path |
| Lambda | Go source adapters, hot-path detector, small activation handlers |
| Step Functions | Cold-path orchestration with branching, retries, and failure handling |
| CloudWatch | Logs, latency, error, usage, and cost alarms |

## External Services

| Service | Purpose |
| --- | --- |
| Nebius AI Studio | Structured LLM extraction, summaries, action recommendations, JSON output |
| Cohere | Reranking and embedding where needed |
| Pinecone | Production vector search and semantic retrieval |
| Firecrawl | Managed extraction for normal web pages |
| Bright Data | LinkedIn/social/protected-source extraction |
| WebShare | Low-cost proxy rotation |
| Resend | Email notifications and outreach drafts |
| n8n / Lambda playbooks | CRM sync, tasks, sequences, webhooks |
| Clerk | Dashboard authentication |
| Vercel | Next.js dashboard hosting |

## Why AWS-Native Over Temporal For V1

The current target stack already uses AWS heavily. EventBridge, SQS, Lambda, and Step Functions are sufficient for the first production version and reduce operational surface area.

Temporal remains a future option if workflows become long-running, cross-language, or operationally complex beyond Step Functions.
