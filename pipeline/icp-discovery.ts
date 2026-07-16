import type OpenAI from "openai";
import { supabase } from "./clients.js";
import { config } from "./config.js";
import { searchPages, type CrawledPage } from "./crawl.js";
import { normalizeName, slugify } from "./discovery.js";
import { computeHotness, icpIsMeaningful, scoreIcpFit, type IcpRow } from "./icp.js";
import { normalizeForMatch } from "./quality.js";
import { IcpMatchesSchema, type IcpMatch, type IcpProfile } from "./schemas.js";

/**
 * ICP-driven lead discovery — the top-of-funnel crawler. Instead of only finding
 * entities mentioned alongside watched accounts, this searches the open web from
 * the ICP configuration (verticals + keywords + regions), extracts named companies
 * that plausibly fit, scores them, and drops the good ones into lead_candidates
 * with discovery_source='icp_search'. From there the flow is identical: the user
 * adds a lead to monitoring, it gets crawled continuously, and its signals become
 * opportunities.
 *
 * PURE where it matters (LLM client injected) so it can run from the Trigger.dev
 * task, the stage runner, or an API route. Firecrawl runs server-side only.
 */

/** Rotate a small set of signal intents so queries surface companies *doing something*. */
const INTENTS = [
  "expanding production",
  "hiring automation engineers",
  "new manufacturing facility",
  "scaling production capacity",
  "investing in factory automation",
];

/** Build a bounded set of web-search queries from the ICP. */
export function buildIcpQueries(icp: IcpProfile, max = 5): string[] {
  const region = icp.regions[0] ?? "";
  const queries: string[] = [];

  icp.verticals.slice(0, 3).forEach((vertical, i) => {
    queries.push(`${vertical} manufacturer ${INTENTS[i % INTENTS.length]} ${region}`.trim());
  });
  for (const kw of icp.keywords.slice(0, 2)) {
    queries.push(`${kw} company ${region}`.trim());
  }
  // Fallback if the ICP has no verticals/keywords but does have an offering.
  if (queries.length === 0 && icp.offering.trim()) {
    queries.push(`companies that need ${icp.offering.split(/[.,—-]/)[0].trim()} ${region}`.trim());
  }
  return [...new Set(queries)].slice(0, max);
}

const MATCH_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["matches"],
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "type", "reason", "evidence_excerpt"],
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ["person", "company"] },
          reason: { type: "string" },
          evidence_excerpt: { type: "string" },
        },
      },
    },
  },
} as const;

function icpLine(icp: IcpProfile): string {
  const parts = [
    icp.offering && `sells ${icp.offering}`,
    icp.verticals.length && `verticals ${icp.verticals.join(", ")}`,
    icp.keywords.length && `keywords ${icp.keywords.join(", ")}`,
    icp.pain_themes.length && `solves ${icp.pain_themes.join(", ")}`,
  ].filter(Boolean);
  return parts.join("; ");
}

/** Pull named companies/people from a search-result page that plausibly fit the ICP. */
async function extractMatches(
  client: OpenAI,
  model: string,
  icp: IcpProfile,
  page: CrawledPage,
): Promise<IcpMatch[]> {
  const system =
    `You find B2B outbound prospects for a seller with this ICP: ${icpLine(icp)}. ` +
    `From the web content, list REAL named companies (or people) that plausibly match the ICP as ` +
    `targets — they operate in the target verticals and could need what the seller offers. ` +
    `For each: name, type, reason (why they fit), evidence_excerpt (a VERBATIM substring proving it). ` +
    `EXCLUDE the seller itself, the seller's competitors/vendors, publishers, directories, the search ` +
    `engine, generic groups ("manufacturers", "startups"), and any DEFUNCT or purely HISTORICAL company ` +
    `(only currently-operating businesses you could sell to today). Only concrete named organizations ` +
    `that appear in the content. An empty array is correct if none qualify. Return strict JSON.`;
  const user = `Source URL: ${page.url}\nTitle: ${page.title ?? "n/a"}\n\nContent:\n${page.markdown.slice(0, 8000)}`;

  const res = await client.chat.completions.create({
    model,
    temperature: 0,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "icp_matches", strict: true, schema: MATCH_JSON_SCHEMA },
    } as never,
  });
  return IcpMatchesSchema.parse(JSON.parse(res.choices[0]?.message?.content ?? "{}")).matches;
}

export interface DiscoverOptions {
  icp: IcpRow;
  client: OpenAI;
  model: string;
  maxQueries?: number;
  resultsPerQuery?: number;
  minFit?: number; // only propose candidates at/above this ICP fit (default 40)
}

export interface DiscoverResult {
  queries: string[];
  pagesSearched: number;
  proposed: number;
  skippedExisting: number;
  skippedLowFit: number;
}

/** Grounding + dedup + fit-score + upsert for the companies found on one page. */
async function processPage(
  page: CrawledPage,
  opts: { icp: IcpRow; client: OpenAI; model: string; minFit: number; seen: Set<string> },
  result: DiscoverResult,
  found: DiscoveredLead[],
): Promise<void> {
  const db = supabase();
  const matches = await extractMatches(opts.client, opts.model, opts.icp, page);
  const hay = normalizeForMatch(page.markdown);

  for (const m of matches) {
    const norm = normalizeName(m.name);
    if (norm.length < 3) continue;
    const key = `${norm}:${m.type}`;
    if (opts.seen.has(key)) continue;
    opts.seen.add(key);

    // Grounding: the evidence must actually appear on the page.
    const needle = normalizeForMatch(m.evidence_excerpt ?? "");
    if (needle.length < 20 || !hay.includes(needle.slice(0, 80))) continue;

    // Skip anything already tracked as an entity or an existing candidate.
    const ingestKey = `${m.type}:${slugify(m.name)}`;
    const { data: entityHit } = await db
      .from("entities")
      .select("id")
      .or(`ingest_key.eq.${ingestKey},name.ilike.${m.name.replace(/[%,()]/g, "")}`)
      .limit(1)
      .maybeSingle();
    if (entityHit) {
      result.skippedExisting++;
      continue;
    }
    const { data: candHit } = await db
      .from("lead_candidates")
      .select("id, mention_count")
      .eq("normalized_name", norm)
      .eq("type", m.type)
      .maybeSingle();

    const fit = await scoreIcpFit(opts.client, opts.model, {
      icp: opts.icp,
      subject: { name: m.name, type: m.type, context: m.reason },
    });
    if (fit.fit < opts.minFit) {
      result.skippedLowFit++;
      continue;
    }
    const hotness = computeHotness(fit.fit, 50);
    const evidence = [{ source_url: page.url, excerpt: m.evidence_excerpt }];

    if (candHit) {
      await db
        .from("lead_candidates")
        .update({
          mention_count: (candHit.mention_count ?? 1) + 1,
          last_seen_at: new Date().toISOString(),
          reason: m.reason,
          icp_fit: fit.fit,
          icp_fit_reason: fit.reason,
          hotness,
        })
        .eq("id", candHit.id);
      result.skippedExisting++;
      found.push({ name: m.name, type: m.type, icp_fit: fit.fit, hotness, reason: m.reason });
      continue;
    }

    const { error } = await db.from("lead_candidates").insert({
      name: m.name,
      normalized_name: norm,
      type: m.type,
      reason: m.reason,
      discovery_source: "icp_search",
      evidence,
      icp_fit: fit.fit,
      icp_fit_reason: fit.reason,
      hotness,
    });
    if (error && !/duplicate key/i.test(error.message)) throw error;
    if (!error) {
      result.proposed++;
      found.push({ name: m.name, type: m.type, icp_fit: fit.fit, hotness, reason: m.reason });
    }
  }
}

export interface DiscoveredLead {
  name: string;
  type: "person" | "company";
  icp_fit: number;
  hotness: number;
  reason: string;
}

/** Scheduled/ICP-driven discovery: build queries from the ICP, search, propose fits. */
export async function discoverLeads(opts: DiscoverOptions): Promise<DiscoverResult> {
  if (!icpIsMeaningful(opts.icp)) {
    throw new Error("ICP is empty — set verticals/keywords/offering before discovering leads.");
  }
  const minFit = opts.minFit ?? config.tuning.minLeadFit;
  const queries = buildIcpQueries(opts.icp, opts.maxQueries ?? 5);
  const result: DiscoverResult = { queries, pagesSearched: 0, proposed: 0, skippedExisting: 0, skippedLowFit: 0 };

  const pages = await searchPages(queries, opts.resultsPerQuery ?? config.tuning.searchResultsPerQuery);
  result.pagesSearched = pages.length;

  const seen = new Set<string>();
  const found: DiscoveredLead[] = [];
  for (const page of pages) {
    await processPage(page, { icp: opts.icp, client: opts.client, model: opts.model, minFit, seen }, result, found);
  }
  return result;
}

/**
 * User-driven search: run ONE free-text query the user typed, extract companies,
 * and propose the fits. Interactive (the user waits for results), so it applies NO
 * fit floor by default — the user explicitly searched, so we show everything found
 * (ranked by fit in the UI). Returns the leads so the caller can report them.
 */
export async function discoverFromQuery(
  query: string,
  opts: { icp: IcpRow; client: OpenAI; model: string; resultsPerQuery?: number; minFit?: number },
): Promise<{ result: DiscoverResult; found: DiscoveredLead[] }> {
  if (!icpIsMeaningful(opts.icp)) {
    throw new Error("Set your ICP first — search results are scored against it.");
  }
  const result: DiscoverResult = { queries: [query], pagesSearched: 0, proposed: 0, skippedExisting: 0, skippedLowFit: 0 };
  const pages = await searchPages([query], opts.resultsPerQuery ?? config.tuning.searchResultsPerQuery);
  result.pagesSearched = pages.length;

  const seen = new Set<string>();
  const found: DiscoveredLead[] = [];
  for (const page of pages) {
    await processPage(page, { icp: opts.icp, client: opts.client, model: opts.model, minFit: opts.minFit ?? 0, seen }, result, found);
  }
  found.sort((a, b) => (b.hotness - a.hotness) || (b.icp_fit - a.icp_fit));
  return { result, found };
}
