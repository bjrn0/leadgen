# Product Specification

## Vision

LeadGen is an internal go-to-market intelligence engine for sales, business development, and account research teams. It turns public internet signals into evidence-backed sales actions.

The product is not a generic lead scraper, transcript product, or content-repurposing tool. It is a signal-to-action console with two distinct but connected pillars:

- **Lead Generation / Discovery Engine**: find new companies, people, and contact paths that match an ICP.
- **Account Monitoring / Intelligence Engine**: continuously track known target accounts and summarize what changed.

## Core Principles

- **Evidence first**: every lead, alert, score, and recommendation must link back to source evidence.
- **Hot path + cold path**: detect fast first, process deeply only when something is relevant.
- **Three-pillar ingestion**: structured feeds/APIs, managed web/social extraction, and multimedia transcription all feed the same pipeline.
- **Idempotent by default**: retries and repeated source checks must not create duplicate leads, alerts, or outreach events.
- **Compliance from day one**: suppression, lawful-basis metadata, and audit trails are core product objects.
- **Cost-aware intelligence**: Nebius AI Studio, Cohere, Pinecone, Firecrawl, Bright Data, and proxy usage must be logged and budgetable.

## Pillar 1: Lead Generation

Lead generation is broad, fluid, and discovery-oriented. It is used when the user wants to find companies or people they do not already know.

### What the user defines

- ICP rule: vertical, region, company size, buyer focus, keywords, technologies, funding signals, job-title triggers, pain themes.
- Notification routing: email via Resend and webhook destination.
- Optional filters: fit score, vertical, region, company size, buyer role, signal recency.

### What the engine returns

- New companies matching the ICP.
- Relevant prospects and decision-makers.
- Contact paths and enrichment state.
- Fit score and urgency.
- Source-backed reasons why the lead matters now.
- Evidence timeline and recommended next action.

### Required actions

- Review lead.
- Start outreach.
- Enrich contacts.
- Push company/contact to CRM.
- Add to Watchlist for deeper monitoring.
- Suppress company/contact forever.
- Mark as qualified or not relevant.

## Pillar 2: Account Monitoring

Account monitoring is narrow, deep, and relationship-oriented. It is used when the user already knows an account and wants to stay current.

### What the user defines

- Watchlisted company or project.
- Source registry: company site, RSS, blog, careers page, YouTube, podcasts, LinkedIn/company profiles via managed providers, executive/public profile URLs, custom URLs.
- Notification routing: email via Resend and webhook destination.
- Monitoring cadence: default 3-hour digest plus urgent alert triggers.

### What the engine returns

- Permanent account intelligence hub.
- Last 3 hours breakdown.
- Evidence timeline.
- High-urgency signals.
- Contact and relationship context.
- Recommended actions grounded in evidence.

### Required actions

- Refresh now.
- Add custom source.
- Draft email.
- Create task.
- Log CRM note or opportunity.
- Add monitoring signal to outreach history.
- Promote new related entities into lead discovery when useful.

## Lead Generation vs Monitoring

| Aspect | Lead Generation | Account Monitoring |
| --- | --- | --- |
| Goal | Discover new companies and people | Track known high-priority accounts |
| Trigger | ICP rule or ad-hoc search | User adds account to Watchlist |
| Scope | Broad and fluid | Focused and deep |
| Output | Hot/warm leads, contacts, CRM-ready records | Deltas, summaries, alerts, next best actions |
| Time horizon | "Who matches now or recently?" | "What changed since last check?" |
| User mindset | Fill the funnel | Stay ready to act on target accounts |
| Primary ROI | More qualified pipeline | Faster, more relevant account action |

## How The Pillars Connect

- A lead can be promoted to Monitoring with **Add to Watchlist**.
- Promotion copies existing signals and evidence into the account timeline.
- Monitoring uses the same signal, evidence, contact, scoring, and search infrastructure.
- Monitoring may produce account actions, CRM notes, or outreach tasks, but it should not create confusing duplicate "lead queue" concepts.
- Search spans both pillars but preserves context: discovery signals and monitoring signals remain distinct.

## Success Criteria

- Users can define an ICP and receive scored, evidence-backed leads.
- Users can add a target account and receive continuous 3-hour breakdowns.
- Every recommendation has a source URL, timestamp, excerpt, confidence, and action rationale.
- The system avoids duplicate signals across retries and repeated checks.
- The dashboard makes it obvious whether the user is discovering new leads or monitoring known accounts.
