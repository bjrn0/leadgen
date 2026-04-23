# UI Mapping And Feature Plan

## Product Shape

The dashboard has two primary modes:

- **Lead Generation**: discovery inbox for new leads.
- **Monitoring**: watchlist intelligence hub for known accounts.

They share navigation, search, evidence views, notifications, contacts, CRM actions, and compliance state, but the user intent is different in each mode.

## Reused Ideas From PodZeus

- Searchable corpus mindset.
- Evidence-first result cards.
- Timestamped or source-linked moments.
- Monitoring and alerting.
- Structured intelligence output.
- Export/API/integration thinking.

## Replaced Concepts

- Transcript search -> account, signal, evidence, and contact search.
- Brand monitoring -> watchlist account monitoring.
- Episode intelligence -> signal and account intelligence.
- Content repurposing -> sales actions and CRM activation.
- Creator workflow -> sales/BDM workflow.

## Lead Generation View

### Left Column: Discovery Inbox

Purpose: show new companies/people found by active ICP rules.

Must show:

- count of visible and matching leads
- max 5 visible lead cards with scroll
- pagination controls
- selected lead state
- company name
- segment/vertical
- urgency
- fit score
- notification routing icons: email and webhook
- short reason why the lead appeared

### Filters Modal

Opened from the top `Filters` button, not embedded inside the inbox.

Must include:

- minimum fit score
- vertical
- region
- company size
- buyer focus
- reset action
- apply action

Filters should mirror the dimensions used by the ICP rule so the user understands what they are narrowing.

### New ICP Rule Modal

Opened from `New ICP Rule`.

Must include:

- vertical
- region
- company size
- buyer focus
- discovery intent
- notification routing:
  - Resend email address
  - webhook URL

Discovery Intent and Notifications must be clearly separated sections.

### Right Column: Lead Workspace

Must show:

- selected company header
- notification routing icons
- actions:
  - Add to Watchlist
  - Push to CRM
  - Suppress
- "What Happened" summary
- key signals
- evidence timeline
- enriched contacts
- batch actions:
  - Mark as Qualified
  - Watch Similar Companies
  - Export Selected Evidence

### Lead Actions And Backend Events

| UI action | Backend event |
| --- | --- |
| New ICP Rule | create/update `icp_rule`, create scheduler route |
| Apply Filters | update local query state; no ingestion side effect |
| Select lead | load `lead_candidate`, signals, contacts, evidence |
| Add to Watchlist | create `watchlist_account`, copy evidence into timeline, start monitoring schedule |
| Push to CRM | emit CRM sync event |
| Suppress | create `suppression_entry`, hide future matches |
| Start outreach / sequence | create `outreach_event`, trigger Resend/n8n |

## Monitoring View

### Left Column: Watchlist

Purpose: show known accounts being continuously monitored.

Must show:

- count of visible and total accounts
- max 5 visible account cards with scroll
- pagination controls
- selected account state
- account name
- tier
- latest signal time
- source count
- urgency
- signal strength score
- notification routing icons: email and webhook

### Add Account Modal

Opened from `Add Account`.

Must include:

- account name
- tier
- source list
- notification routing:
  - Resend email address
  - webhook URL

Creating an account should create an account record, source registry entries, notification routes, and scheduler entries.

### Right Column: Account Intelligence Hub

Must show:

- selected account header
- notification routing icons
- actions:
  - Create Task
  - Draft Email
- Last 3 Hours breakdown
- evidence timeline
- alert rules
- custom sources
- next best actions inside the same account hub
- outreach draft / CRM logging controls

### Monitoring Actions And Backend Events

| UI action | Backend event |
| --- | --- |
| Add Account | create account/watchlist/source registry/scheduler |
| Select account | load timeline, sources, summaries, actions |
| Refresh Now | enqueue immediate source checks |
| Add Custom Source | create source, run first fetch |
| Create Task | emit CRM/n8n task event |
| Draft Email | generate or edit Resend-ready draft |
| Start Outreach | create outreach event, trigger Resend/n8n |
| Log in CRM | emit CRM note/opportunity event |

## Shared UI Rules

- Evidence links must be visible and clickable.
- Buttons should use icons for actions.
- Status and routing state should use compact badges/icons.
- Do not duplicate concepts such as "lead queue" inside Monitoring.
- Monitoring actions should read as account actions, not rediscovery actions.
- Lead Generation should feel broad and triage-focused.
- Monitoring should feel deep and account-focused.

## Route / Navigation Map

Current simplified navigation:

- `Lead Generation`
- `Monitoring`

Future routes can split out:

- `/search`
- `/contacts`
- `/integrations`
- `/settings`
- `/suppression`
- `/audit`
