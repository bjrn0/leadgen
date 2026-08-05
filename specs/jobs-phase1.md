# Job Vacancy Collection — Phase 1

## Goal

Collect **real, structured job postings** for a monitored company from that
company's own careers site, starting **the moment a discovered lead is added to
monitoring**. Phase 1 stays on the existing stack (Firecrawl, Nebius, Supabase)
and folds vacancies into the current monitoring cycle so they become `hiring`
opportunities through the funnel that already exists. No paid providers and no
LinkedIn in this phase — those are Phase 2.

## Two gaps Phase 1 must close

- **A freshly-added lead has no URLs.** When a lead is promoted to a monitored
  account it is created from the candidate's **name only** — no website, no
  careers page. So company identity must be *resolved* before any vacancy can be
  crawled.
- **There is no vacancy object.** Today `hiring` exists only as a free-text
  signal type on an insight; nothing stores a list of open positions. Phase 1
  introduces a first-class job-postings object.

## Approach

A company's open roles can live in more than one place at once — an ATS board,
its own `/careers` page, or both (and the own-site page is often just a shell
that embeds or links out to the ATS). So collection is **additive**: resolve
*every* careers surface the company exposes, collect from all of them, and merge
by dedupe key. It is not an either/or choice of a single source.

Per surface, reuse-first in this order of preference:

1. **Structured ATS API** when a surface resolves to Greenhouse or Lever —
   public, keyless JSON, gives a stable job ID. Preferred whenever available.
2. **Managed extraction** for the company's own careers page — Firecrawl scrape
   (with the existing Browserbase fallback for JS-heavy pages), then structured
   extraction of the visible roles. This is the path that captures vacancies
   posted directly on the company's own site rather than on an ATS.

This mirrors the collection priority in [sources.md](sources.md): official API
first, managed extraction only where there is no clean API — applied per surface
rather than picking one surface for the whole company. The same role appearing
on both the own site and an ATS is collapsed by the dedupe key (below), so
covering multiple surfaces never double-counts.

## Flow

```text
add lead to monitoring
  -> resolve company identity from the open web:
       official domain + every careers surface (own /careers and/or ATS board)
  -> register one 'careers' source per resolved surface
  -> first monitoring cycle:
       for each careers source: collect jobs (ATS API or scrape+extract)
       merge across sources by dedupe key
       upsert job postings + diff previous snapshot (open/closed)
       emit a hiring signal for newly-opened roles
  -> existing opportunity derivation ranks it with ICP fit
```

Identity resolution is the new front step and the one that gates everything: if
we cannot confidently resolve the company's domain, we register no careers source
rather than risk crawling the wrong company's jobs. When the domain is resolved,
we register every careers surface we can attribute to it — the own-site careers
page and any ATS board — not just the first one found.

## New Objects

### `job_postings`

One row per open role per monitored account. Fields the object must carry:

- account reference and collection `source` (careers / greenhouse / lever;
  linkedin in Phase 2)
- external ATS job id when available
- dedupe key (see below)
- title, department, location, remote flag, seniority, employment type
- posting URL and posted date
- first-seen, last-seen, and closed timestamps
- status (open / closed)
- evidence (source URL + verbatim excerpt) and raw provider payload

### `sources` extension

The source registry gains a `careers` kind so a company's careers page /
ATS board is a first-class, schedulable collection point alongside its website
and search queries. (`linkedin_jobs` is added in Phase 2.)

## Status And Diffing

`open` vs `closed` is derived by diffing successive snapshots per **account**,
against the merged set of dedupe keys across all of that account's careers
sources (not per source — a role posted on both the own site and an ATS must
stay open while it is still present on either). A dedupe key present last cycle
but absent from the current merged snapshot is marked `closed` with a timestamp.
Dedupe keys new to the merged snapshot are the newly-opened roles that drive the
hiring signal.

## Dedupe Keys

Consistent with the dedupe strategy in [data-model.md](data-model.md):

| Source | Dedupe key |
| --- | --- |
| Greenhouse / Lever | ATS job ID |
| Scraped careers page | normalized(title) + normalized(location) |

Reuse the existing name-normalization used by lead discovery so title/location
keys are stable across re-crawls.

## Identity Resolution

From the company name we search the open web for the official site and careers
page, then pick the canonical domain. Guardrails, consistent with the engine's
anti-fabrication rules:

- the evidence proving the domain must appear verbatim in a fetched page
- a confidence floor below which no careers source is registered
- wrong-domain resolution is the worst failure mode, so bias toward registering
  **no** source over a shaky one

Detecting Greenhouse/Lever from the resolved URL is a pure string check and
selects the ATS-API path over scraping.

## Reusing The Existing Funnel

Newly-opened roles are summarized into a single `hiring` signal per cycle
(evidence = the job URLs) so the existing opportunity derivation and ICP-fit
scoring apply unchanged. No parallel scoring or queue is introduced — vacancies
surface in Lead Generation the same way every other signal does.

## Integration Points

- **Add-to-monitoring path** — resolve identity and register the careers source
  when a lead becomes an account (and, for parity, when an account is added via
  the form with no careers URL supplied).
- **Monitoring cycle** — a job-collection step runs alongside page crawling, on
  the same cadence in Phase 1. It is kept separable so Phase 2 can move it to a
  dedicated task with its own (cheaper) cadence once a paid provider is involved.
- **Run stats** — the cycle reports opened/closed counts for observability.
- **UI** — surface an open-role count on the monitoring account card. Optional
  for a functional Phase 1, since the hiring opportunity already appears in the
  lead queue.

## Risks

| Risk | Mitigation |
| --- | --- |
| Freshly-added lead has no URL to crawl | Identity resolution is a hard prerequisite step, not optional |
| Wrong company resolved | Verbatim grounding + confidence floor; prefer no source over a wrong one |
| Careers pages on Workday / SuccessFactors that Firecrawl can't read | Browserbase fallback; skip-with-log when still unreadable |
| Same role reported twice across future sources | Dedupe key defined now so Phase 2's LinkedIn merge is additive |

## Success Criteria

- Adding a lead whose company uses Greenhouse or Lever yields structured open
  roles via the ATS API on the first cycle.
- Adding a lead with a plain careers page yields grounded roles via managed
  extraction.
- Re-crawls do not duplicate roles; disappeared roles flip to `closed`.
- Newly-opened roles produce a hiring opportunity ranked by ICP fit.
- A company whose domain can't be resolved confidently registers no careers
  source and produces no fabricated vacancies.

## Phase 2 (reference)

LinkedIn Jobs via a managed provider (Bright Data per
[sources.md](sources.md)), cross-source merge on the shared dedupe key,
open/closed diffing across both sources, and a dedicated job-collection task so
the paid provider runs on its own cadence.
