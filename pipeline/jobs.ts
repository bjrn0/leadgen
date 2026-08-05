import type OpenAI from "openai";
import { supabase } from "./clients.js";
import { scrapePageWithFallback } from "./crawl.js";
import { chunkText } from "./extract.js";
import { normalizeName } from "./discovery.js";
import { normalizeForMatch } from "./quality.js";
import { atsToken } from "./resolve.js";
import { JobPostingsSchema, type JobPosting } from "./schemas.js";
import type { CareersSurface } from "./resolve.js";

/**
 * Job-vacancy collection (Phase 1). For a monitored company we collect real,
 * structured open roles from every careers surface it exposes:
 *   - Greenhouse / Lever  -> public, keyless JSON API (stable job id)
 *   - own careers page     -> Firecrawl scrape (+ Browserbase fallback) + LLM extract
 * Roles are merged across surfaces by dedupe key, upserted idempotently, and
 * diffed at the account level to flip disappeared roles to 'closed'. Newly-opened
 * roles become one 'hiring' insight so the existing opportunity/ICP funnel ranks
 * them unchanged (deriveOpportunities picks it up — no parallel scoring).
 *
 * PURE where it matters (LLM client injected). Firecrawl / ATS fetches are
 * server-side only.
 */

export interface CollectedJob {
  posting: JobPosting;
  source: "greenhouse" | "lever" | "careers";
  external_job_id: string | null;
}

/** dedupe key: ATS job id when we have one, else normalized title|location. */
export function dedupKey(job: CollectedJob): string {
  if (job.external_job_id) return `${job.source}:${job.external_job_id}`;
  return `${normalizeName(job.posting.title)}|${normalizeName(job.posting.location ?? "")}`;
}

/**
 * Merge collected jobs across all of an account's careers surfaces into one row
 * per dedupe key — a role posted on both the own site and an ATS is a single
 * entry. Prefer the entry carrying an ATS job id (more stable). Pure (no DB) so
 * the merge is unit-testable.
 */
export function mergeCollected(collected: CollectedJob[]): Map<string, CollectedJob> {
  const merged = new Map<string, CollectedJob>();
  for (const job of collected) {
    const key = dedupKey(job);
    const prev = merged.get(key);
    if (!prev || (!prev.external_job_id && job.external_job_id)) merged.set(key, job);
  }
  return merged;
}

// ---------------------------------------------------------------------------
// ATS adapters — public, keyless JSON. Defensive mapping (fields are optional).
// ---------------------------------------------------------------------------
async function fetchGreenhouse(token: string): Promise<CollectedJob[]> {
  // content=false keeps the payload small (title/location/url/id). departments are
  // only returned with content=true, which balloons the response (~4MB for a large
  // board, full HTML per job) — not worth it for a nullable field in Phase 1, so
  // Greenhouse `department` stays null. Switch to content=true if departments matter.
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=false`);
  if (!res.ok) throw new Error(`greenhouse ${res.status} for ${token}`);
  const data = (await res.json()) as { jobs?: GreenhouseJob[] };
  return (data.jobs ?? []).map((j) => ({
    source: "greenhouse" as const,
    external_job_id: j.id != null ? String(j.id) : null,
    posting: {
      title: j.title ?? "Untitled role",
      department: j.departments?.[0]?.name ?? null,
      location: j.location?.name ?? null,
      remote: /remote/i.test(j.location?.name ?? ""),
      seniority: null,
      employment_type: null,
      url: j.absolute_url ?? null,
      posted_at: safeIso(j.updated_at ?? j.first_published),
      evidence_excerpt: j.title ?? "",
    },
  }));
}

async function fetchLever(company: string): Promise<CollectedJob[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`);
  if (!res.ok) throw new Error(`lever ${res.status} for ${company}`);
  const data = (await res.json()) as LeverPosting[];
  return (data ?? []).map((p) => ({
    source: "lever" as const,
    external_job_id: p.id ?? null,
    posting: {
      title: p.text ?? "Untitled role",
      department: p.categories?.team ?? null,
      location: p.categories?.location ?? null,
      remote: (p.workplaceType ?? "").toLowerCase() === "remote",
      seniority: null,
      employment_type: p.categories?.commitment ?? null,
      url: p.hostedUrl ?? null,
      posted_at: p.createdAt ? new Date(p.createdAt).toISOString() : null,
      evidence_excerpt: p.text ?? "",
    },
  }));
}

// ---------------------------------------------------------------------------
// Careers-page adapter — scrape + LLM extract, verbatim-grounded (same
// anti-fabrication rule as extract/discovery: the excerpt must be on the page).
// ---------------------------------------------------------------------------
const JOBS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["jobs"],
  properties: {
    jobs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "department",
          "location",
          "remote",
          "seniority",
          "employment_type",
          "url",
          "posted_at",
          "evidence_excerpt",
        ],
        properties: {
          title: { type: "string" },
          department: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          remote: { type: ["boolean", "null"] },
          seniority: { type: ["string", "null"] },
          employment_type: { type: ["string", "null"] },
          url: { type: ["string", "null"] },
          posted_at: { type: ["string", "null"] },
          evidence_excerpt: { type: "string" },
        },
      },
    },
  },
} as const;

async function extractCareersJobs(
  client: OpenAI,
  model: string,
  markdown: string,
  pageUrl: string,
): Promise<CollectedJob[]> {
  const system =
    `You extract OPEN JOB VACANCIES from a company's careers/jobs page. List only concrete, ` +
    `currently-open roles that appear in the content — never invent a role, title, location, or ` +
    `date. evidence_excerpt MUST be copied VERBATIM (an exact substring) from the supplied content ` +
    `— normally the role title as it appears. If the page lists no concrete openings (it's a ` +
    `generic careers landing page, a benefits blurb, or a login wall), return an empty jobs array. ` +
    `An empty array is correct and expected. Return strict JSON.`;
  const hay = normalizeForMatch(markdown);
  const out: CollectedJob[] = [];
  const seen = new Set<string>();

  for (const chunk of chunkText(markdown)) {
    const user = `Careers page URL: ${pageUrl}\n\nContent:\n${chunk}`;
    const res = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "job_postings", strict: true, schema: JOBS_JSON_SCHEMA },
      } as never,
    });
    const parsed = JobPostingsSchema.parse(JSON.parse(res.choices[0]?.message?.content ?? "{}"));
    for (const posting of parsed.jobs) {
      // Grounding: the excerpt must actually be on the page.
      const needle = normalizeForMatch(posting.evidence_excerpt);
      if (needle.length < 4 || !hay.includes(needle.slice(0, 80))) continue;
      const key = `${normalizeName(posting.title)}|${normalizeName(posting.location ?? "")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        source: "careers",
        external_job_id: null,
        posting: { ...posting, url: posting.url ?? pageUrl },
      });
    }
  }
  return out;
}

/** Collect open roles from one careers surface (ATS API or scrape+extract). */
export async function collectJobs(
  surface: CareersSurface,
  opts: { client: OpenAI; model: string },
): Promise<CollectedJob[]> {
  if (surface.source === "greenhouse") {
    const token = atsToken(surface.url);
    if (!token) return [];
    return fetchGreenhouse(token);
  }
  if (surface.source === "lever") {
    const company = atsToken(surface.url);
    if (!company) return [];
    return fetchLever(company);
  }
  const page = await scrapePageWithFallback(surface.url);
  if (!page) return [];
  return extractCareersJobs(opts.client, opts.model, page.markdown, page.url);
}

// ---------------------------------------------------------------------------
// Persistence: merge across surfaces, upsert idempotently, diff-close.
// ---------------------------------------------------------------------------
export interface UpsertJobsResult {
  opened: CollectedJob[];
  closed: number;
  total: number;
}

/**
 * Merge collected jobs across all of an account's careers surfaces and reconcile
 * with the DB: new dedupe keys are inserted (status 'open') and returned as the
 * newly-opened roles; seen keys bump last_seen_at (and reopen if previously
 * closed); open rows absent from the merged snapshot flip to 'closed'.
 */
export async function upsertJobPostings(
  entityId: string,
  collected: CollectedJob[],
): Promise<UpsertJobsResult> {
  const db = supabase();

  // Merge duplicates across surfaces before touching the DB.
  const merged = mergeCollected(collected);

  const { data: existingRows, error: selErr } = await db
    .from("job_postings")
    .select("id, dedup_key, status")
    .eq("entity_id", entityId);
  if (selErr) throw selErr;
  const existing = new Map((existingRows ?? []).map((r) => [r.dedup_key as string, r]));

  const nowIso = new Date().toISOString();
  const opened: CollectedJob[] = [];

  for (const [key, job] of merged) {
    const row = existing.get(key);
    const evidence = [{ source_url: job.posting.url, excerpt: job.posting.evidence_excerpt }];
    if (!row) {
      const { error } = await db.from("job_postings").insert({
        entity_id: entityId,
        source: job.source,
        external_job_id: job.external_job_id,
        dedup_key: key,
        title: job.posting.title,
        department: job.posting.department,
        location: job.posting.location,
        remote: job.posting.remote,
        seniority: job.posting.seniority,
        employment_type: job.posting.employment_type,
        url: job.posting.url,
        posted_at: job.posting.posted_at,
        last_seen_at: nowIso,
        status: "open",
        evidence,
      });
      // Tolerate a race where a concurrent run inserted the same key first.
      if (error && !/duplicate key/i.test(error.message)) throw error;
      if (!error) opened.push(job);
    } else {
      const reopen = row.status === "closed";
      const { error } = await db
        .from("job_postings")
        .update({
          last_seen_at: nowIso,
          status: "open",
          closed_at: null,
          // refresh mutable fields in case the posting changed
          department: job.posting.department,
          location: job.posting.location,
          url: job.posting.url,
        })
        .eq("id", row.id);
      if (error) throw error;
      if (reopen) opened.push(job); // a role that came back counts as newly open
    }
  }

  // Diff-close: open rows whose key is not in the current merged snapshot.
  // Guard: an EMPTY snapshot almost always means a transient collection failure
  // (Firecrawl/ATS down, scrape blocked), not "every role closed" — closing all
  // rows on that would be destructive, so we skip diff-close when we saw nothing.
  const present = new Set(merged.keys());
  const toClose =
    merged.size === 0
      ? []
      : (existingRows ?? []).filter((r) => r.status === "open" && !present.has(r.dedup_key));
  if (toClose.length > 0) {
    const { error } = await db
      .from("job_postings")
      .update({ status: "closed", closed_at: nowIso })
      .in(
        "id",
        toClose.map((r) => r.id),
      );
    if (error) throw error;
  }

  return { opened, closed: toClose.length, total: merged.size };
}

/**
 * Turn newly-opened roles into ONE 'hiring' insight so the existing opportunity
 * derivation + ICP-fit scoring apply unchanged. Grounded (evidence = the job
 * URLs/titles), quality 'ok' + actionable so deriveOpportunities picks it up.
 */
export async function insertHiringInsight(entityId: string, opened: CollectedJob[]): Promise<void> {
  if (opened.length === 0) return;
  const db = supabase();

  const titles = opened.map((j) => j.posting.title);
  const top = titles.slice(0, 3).join(", ");
  const headline =
    opened.length === 1
      ? `New open role: ${titles[0]}`
      : `${opened.length} new open roles: ${top}${opened.length > 3 ? ", …" : ""}`;
  const locations = [...new Set(opened.map((j) => j.posting.location).filter(Boolean))].slice(0, 5);
  const depts = [...new Set(opened.map((j) => j.posting.department).filter(Boolean))].slice(0, 5);
  const summaryParts = [
    `${opened.length} new opening(s) detected on the company's careers surfaces.`,
    depts.length ? `Teams: ${depts.join(", ")}.` : "",
    locations.length ? `Locations: ${locations.join(", ")}.` : "",
  ].filter(Boolean);

  const evidence = opened.slice(0, 8).map((j) => ({
    source_url: j.posting.url ?? "",
    published_at: j.posting.posted_at,
    excerpt: j.posting.title,
  }));

  // confidence scales with the number of openings (0.6 → 0.85), a soft signal.
  const confidence = Math.min(0.85, 0.6 + opened.length * 0.05);

  const { error } = await db.from("insights").insert({
    entity_id: entityId,
    finding_id: null,
    signal_type: "hiring",
    headline,
    summary: summaryParts.join(" "),
    why_it_matters:
      "Active hiring signals growth and budget, and the specific roles hint at initiatives and pain worth referencing in outreach.",
    recommended_action: "Reach out referencing the open roles and how you help teams scaling those functions.",
    recency_label: "just detected",
    published_at: new Date().toISOString(),
    confidence,
    urgency: "Medium",
    actionable: true,
    quality: "ok",
    evidence,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// ATS response shapes (partial — only the fields we map).
// ---------------------------------------------------------------------------
interface GreenhouseJob {
  id?: number;
  title?: string;
  absolute_url?: string;
  updated_at?: string;
  first_published?: string;
  location?: { name?: string };
  departments?: { name?: string }[];
}

interface LeverPosting {
  id?: string;
  text?: string;
  hostedUrl?: string;
  createdAt?: number;
  workplaceType?: string;
  categories?: { team?: string; location?: string; commitment?: string };
}

function safeIso(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
