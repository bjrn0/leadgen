import type OpenAI from "openai";
import { supabase } from "./clients.js";
import { computeHotness, icpIsMeaningful, scoreIcpFit, type IcpRow } from "./icp.js";
import { normalizeForMatch } from "./quality.js";
import type { EntityInput, MentionedEntity } from "./schemas.js";
import type { CrawledPage } from "./crawl.js";

/**
 * New-lead discovery: the extract pass also emits `mentioned_entities` (people/
 * companies with a stated relationship to the watched target). This module
 * validates those mentions in code — verbatim grounding, self-mention filter —
 * and upserts them into `lead_candidates` for the Lead Generation "New Leads" inbox.
 * Repeat mentions bump mention_count/last_seen_at instead of duplicating; a
 * candidate the user already added or dismissed never reverts to 'proposed'.
 */

const LEGAL_SUFFIXES =
  /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|llc|llp|plc|gmbh|ag|sa|se|bv|nv|oy|ab|kk|pty|srl|sarl|spa|holdings?|group)\b\.?/g;

/** Lowercase, strip punctuation + legal suffixes, collapse whitespace. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mirrors the app's ingest_key derivation (app/src/app/api/entities/route.ts). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface FilteredMention extends MentionedEntity {
  grounded: boolean;
}

/**
 * Validate LLM mentions in code (no extra LLM): the evidence excerpt must appear
 * verbatim in the crawled page, and the mention must not be the target entity
 * itself (or its own company), a too-short name, or an empty relationship claim.
 * Returns kept mentions; ungrounded/self ones are dropped with a reason for logs.
 */
export function filterMentions(
  entity: EntityInput,
  page: CrawledPage,
  mentions: MentionedEntity[],
): { kept: FilteredMention[]; dropped: { name: string; reason: string }[] } {
  const hay = normalizeForMatch(page.markdown);
  const selfNames = new Set(
    [entity.name, entity.company ?? ""].filter(Boolean).map((n) => normalizeName(n)),
  );
  const kept: FilteredMention[] = [];
  const dropped: { name: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (const m of mentions) {
    const norm = normalizeName(m.name);
    if (norm.length < 3) {
      dropped.push({ name: m.name, reason: "name too short" });
      continue;
    }
    if (selfNames.has(norm)) {
      dropped.push({ name: m.name, reason: "self-mention (target or its company)" });
      continue;
    }
    if (seen.has(`${norm}:${m.type}`)) continue; // same page, same mention
    seen.add(`${norm}:${m.type}`);

    const needle = normalizeForMatch(m.evidence_excerpt ?? "");
    const grounded = needle.length >= 20 && hay.includes(needle.slice(0, 80));
    if (!grounded) {
      dropped.push({ name: m.name, reason: "evidence excerpt not found verbatim in page" });
      continue;
    }
    kept.push({ ...m, grounded });
  }
  return { kept, dropped };
}

/**
 * Upsert validated mentions into lead_candidates. Skips names that already exist
 * as entities (by derived ingest_key or case-insensitive name). Existing candidate
 * rows get mention_count/last_seen_at bumps; status never downgrades.
 */
export interface CandidateIcpOptions {
  icp?: IcpRow | null;
  icpClient?: OpenAI;
  model?: string;
}

export async function upsertCandidates(
  entityId: string,
  findingId: string | null,
  page: CrawledPage,
  mentions: FilteredMention[],
  icpOpts: CandidateIcpOptions = {},
): Promise<{ proposed: number; skippedExisting: number }> {
  if (mentions.length === 0) return { proposed: 0, skippedExisting: 0 };
  const db = supabase();
  const scoreFit = icpOpts.icpClient && icpOpts.model && icpIsMeaningful(icpOpts.icp);
  let proposed = 0;
  let skippedExisting = 0;

  for (const m of mentions) {
    const ingestKey = `${m.type}:${slugify(m.name)}`;
    const { data: entityHit, error: eErr } = await db
      .from("entities")
      .select("id")
      .or(`ingest_key.eq.${ingestKey},name.ilike.${m.name.replace(/[%,()]/g, "")}`)
      .limit(1)
      .maybeSingle();
    if (eErr) throw eErr;
    if (entityHit) {
      skippedExisting++;
      continue;
    }

    const normalized = normalizeName(m.name);
    const evidence = [{ source_url: page.url, excerpt: m.evidence_excerpt }];
    const { data: existing, error: selErr } = await db
      .from("lead_candidates")
      .select("id, mention_count, evidence")
      .eq("normalized_name", normalized)
      .eq("type", m.type)
      .maybeSingle();
    if (selErr) throw selErr;

    if (existing) {
      const mergedEvidence = [
        ...((existing.evidence as { source_url: string }[]) ?? []),
        ...evidence,
      ].slice(-5); // keep the 5 most recent excerpts
      const { error } = await db
        .from("lead_candidates")
        .update({
          mention_count: (existing.mention_count ?? 1) + 1,
          last_seen_at: new Date().toISOString(),
          reason: m.reason, // freshest relationship statement wins
          relationship: m.relationship,
          evidence: mergedEvidence,
        })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      // ICP fit for the new lead (cached). Context = its relationship to the
      // watched account, which is all we know about a freshly-discovered entity.
      let icpFit: number | null = null;
      let icpReason: string | null = null;
      let hotness: number | null = null;
      if (scoreFit) {
        const fit = await scoreIcpFit(icpOpts.icpClient!, icpOpts.model!, {
          icp: icpOpts.icp!,
          subject: {
            name: m.name,
            type: m.type,
            context: `${m.relationship ?? "mentioned"}: ${m.reason}`,
          },
        });
        icpFit = fit.fit;
        icpReason = fit.reason;
        hotness = computeHotness(icpFit, 50); // no signal yet — neutral 50 baseline
      }
      const { error } = await db.from("lead_candidates").insert({
        name: m.name,
        normalized_name: normalized,
        type: m.type,
        relationship: m.relationship,
        reason: m.reason,
        source_entity_id: entityId,
        finding_id: findingId,
        evidence,
        icp_fit: icpFit,
        icp_fit_reason: icpReason,
        hotness,
      });
      // Tolerate a race where a concurrent run inserted the same candidate first.
      if (error && !/duplicate key/i.test(error.message)) throw error;
      if (!error) proposed++;
    }
  }
  return { proposed, skippedExisting };
}
