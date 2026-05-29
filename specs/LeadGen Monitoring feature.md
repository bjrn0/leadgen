**Monitoring Feature — Jira-Ready Backlog**

**Scope**

·        Build a Monitoring module (Companies + People) that allows users to:

·        Add companies and people to a watchlist

·        Automatically collect external signals/events

·        Display them in a dashboard + timeline

·        Show recency and urgency

·        Enable quick understanding for client interaction preparation

·        Work without mandatory CRM dependency

**EPIC 1 — Watchlist Management (P0)**

**Story 1.1 — Add Monitored Company**

**Description:** Allow users to add companies to monitoring so they can track updates and signals.

**Acceptance Criteria:**

·        User can create a new monitored company

·        Required fields: Company name (required), Domain (optional), Account type/status (optional)

·        Company appears in watchlist after creation

·        Company has an initial empty detail view

·        Status available: active / paused

**Story 1.2 — Add Monitored Person**

**Description:** Allow users to add people to monitoring to track decision-makers and relevant contacts.

**Acceptance Criteria:**

·        User can create a new monitored person

·        Fields: Full name (required), Title (optional), Company (optional), LinkedIn/public profile URL (optional)

·        Person appears in monitoring list

·        Person can be linked to a company

**Story 1.3 — Watchlist View (List/Table)**

**Description:** Provide a unified monitoring dashboard showing all entities.

**Acceptance Criteria:**

·        Display entities in list or table view

·        Columns include: Name, Type (Company / Person), Latest signal timestamp, Urgency, Signal count or source count, Group/tag (if exists)

·        Default sorting: latest signal or urgency

·        Pagination or lazy loading implemented

**Story 1.4 — Grouping / Tagging**

**Description:** Allow grouping/tagging of monitored entities for better organization.

**Acceptance Criteria:**

·        User can assign group/tag to entity

·        Filtering by group/tag is supported

·        Tag is visible in list and detail view

·        One entity can have multiple tags (optional)

**EPIC 2 — Source Management & Ingestion (P0)**

**Story 2.1 — Link Sources to Entities**

**Description:** Allow system to store data sources per monitored entity.

**Acceptance Criteria:**

·        Each entity has associated sources

·        Supported source types: RSS, Newsroom/news page, Careers page, Blog / executive blog, Custom URL, Profile links (LinkedIn – reference only)

·        Source has status: active / error / paused

**Story 2.2 — Scheduled Source Polling**

**Description:** System periodically checks sources for updates.

**Acceptance Criteria:**

·        Each source has polling schedule

·        Last checked timestamp stored

·        Failure of one source does not affect others

·        System logs polling attempts

**Story 2.3 — Event Normalization**

**Description:** Convert raw updates into structured events.

**Acceptance Criteria:**

·        Event model includes: Entity ID, Title, Summary, Source type + URL, Published timestamp, Detected timestamp, Urgency

·        Support company-level and person-level events

·        Events linked to entities

**Story 2.4 — Event Deduplication**

**Description:** Prevent duplicate events from cluttering the UI.

**Acceptance Criteria:**

·        Duplicate events are merged or hidden

·        Deduplication logic is applied per entity

·        Logging available for debugging

**EPIC 3 — Monitoring Dashboard (P0)**

**Story 3.1 — Monitoring Dashboard UI**

**Description:** Provide a clear, hierarchical dashboard showing key monitoring signals.

**Acceptance Criteria:**

·        List view shows: Latest changes, Urgency indicators, Key summary or preview

·        Clear visual hierarchy implemented

·        Distinguishable from Lead Generation module

**Story 3.2 — Filters & Sorting**

**Description:** Allow users to focus on relevant entities.

**Acceptance Criteria:**

·        Filters: Entity type, Urgency, Recency, Group/tag, Status

·        Sorting: By urgency, By recency, By signal count

·        Filters persist within session

**Story 3.3 — Search**

**Description:** Allow quick lookup of entities.

**Acceptance Criteria:**

·        Search by company name

·        Search by person name

·        Partial match supported

·        Search result opens detail view

**EPIC 4 — Company Detail & Timeline (P0)**

**Story 4.1 — Company Detail Page**

**Description:** Provide a detailed view of a monitored company.

**Acceptance Criteria:**

·        Header shows: Company name, Account type, Latest signal timestamp, Urgency, Number of sources

·        Summary block exists (“What changed”)

**Story 4.2 — Company Timeline**

**Description:** Display event history for a company.

**Acceptance Criteria:**

·        Timeline sorted by most recent events

·        Each event shows: Title, Summary, Source, Timestamp, Urgency

·        Filters available for time window: 24h / 7d / 30d / 90d / 6m

·        No duplicate events displayed

**Story 4.3 — Evidence / Source Drill-down**

**Description:** Allow user to open original source.

**Acceptance Criteria:**

·        Each event includes clickable source link

·        Opens in new tab

·        Graceful handling of broken links

**EPIC 5 — People Monitoring (P0 / High P1)**

**Story 5.1 — Person Detail Page**

**Description:** Provide detailed monitoring view for a person.

**Acceptance Criteria:**

·        Header displays: Name, Title, Linked company, Latest signal

·        Timeline of person events

·        Profile link visible if available

**Story 5.2 — Person–Company Linking**

**Description:** Allow linking people to companies.

**Acceptance Criteria:**

·        Person can be linked to a company

·        Company view shows related people

·        Navigation between person and company works

·        Optional: person events appear in company timeline

**Story 5.3 — LinkedIn/Profile Access**

**Description:** Enable quick access to external profiles.

**Acceptance Criteria:**

·        Profile link visible when available

·        Opens in new tab

·        Proper fallback when missing

**EPIC 6 — Prioritization & Reminders (P1)**

**Story 6.1 — Urgency Scoring**

**Description:** Assign urgency to events and entities.

**Acceptance Criteria:**

·        Event urgency: High / Medium / Low

·        Entity urgency based on latest events

·        Visible in dashboard and detail view

**Story 6.2 — Recency Indicators**

**Description:** Show when the latest signal occurred.

**Acceptance Criteria:**

·        Latest signal timestamp displayed

·        Filters for recency available

·        Consistent timezone handling

**Story 6.3 — Follow-up Reminders**

**Description:** Allow users to track outreach timing.

**Acceptance Criteria:**

·        User can create reminder: Title, Date/time, Note (optional)

·        Reminder displayed in entity detail

·        Overdue reminders highlighted

·        No CRM dependency required

**EPIC 7 — Ownership & Collaboration (P1/P2)**

**Story 7.1 — Assign / Claim Entity**

**Description:** Allow ownership tracking for multi-user usage.

**Acceptance Criteria:**

·        Entity can have an owner

·        User can claim or assign entity

·        Owner visible in UI

**Story 7.2 — Activity Log**

**Description:** Track key actions for each entity.

**Acceptance Criteria:**

·        Log includes: Entity created, Owner changes, Reminder created, Status changes

·        Activity log visible in detail view

**EPIC 8 — Export & External Workflow (P1)**

**Story 8.1 — Export Entities**

**Description:** Allow users to export data for external use.

**Acceptance Criteria:**

·        Export to CSV supported

·        Export includes: Name, Type, Latest signal, Urgency, Timestamp, Source links (optional)

·        Respects filters

**Story 8.2 — Data Boundary Definition**

**Description:** Define data ownership vs external systems.

**Acceptance Criteria:**

·        Monitoring data remains primary in tool

·        Export is one-way

·        CRM sync optional (future)

·        Documented in technical design

**EPIC 9 — Future Integration Hooks (P2)**

**Story 9.1 — CRM Sync Preparation**

**Description:** Prepare data model for future CRM sync.

**Acceptance Criteria:**

·        Support external ID fields

·        Document mapping strategy

·        No full sync required in V1

**Story 9.2 — Integration Hooks (Apollo / API)**

**Description:** Keep architecture open for future integrations.

**Acceptance Criteria:**

·        API-ready output format

·        Architecture does not block integrations

·        Extension points documented