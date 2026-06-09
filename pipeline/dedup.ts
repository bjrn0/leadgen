import { createHash } from "node:crypto";
import { nebius } from "./clients.js";
import { config } from "./config.js";

/**
 * Layered dedup primitives:
 *  - canonicalizeUrl + contentHash  -> exact match (cheap, no LLM)
 *  - embed + pgvector cosine        -> near-duplicate (same story, different URL)
 * The DB-touching decision lives in store.decideDedup(); this module is pure
 * except for embed(), which calls Nebius.
 */

const TRACKING_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^mc_/i,
  /^ref$/i,
  /^ref_src$/i,
  /^igshid$/i,
  /^_hsenc$/i,
  /^_hsmi$/i,
];

export function canonicalizeUrl(input: string): string {
  try {
    const u = new URL(input);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    u.protocol = "https:";
    const keep: [string, string][] = [];
    for (const [k, v] of u.searchParams.entries()) {
      if (!TRACKING_PARAMS.some((re) => re.test(k))) keep.push([k, v]);
    }
    keep.sort(([a], [b]) => a.localeCompare(b));
    u.search = "";
    for (const [k, v] of keep) u.searchParams.append(k, v);
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return input.trim();
  }
}

/** Normalize whitespace + case so trivial reformatting doesn't change the hash. */
export function contentHash(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

/** Embed text with Nebius. Truncated to keep within model limits. */
export async function embed(text: string): Promise<number[]> {
  const res = await nebius().embeddings.create({
    model: config.nebius.embeddingModel,
    input: text.slice(0, 8000),
  });
  return res.data[0].embedding as number[];
}

/** pgvector text literal, e.g. "[0.1,0.2,...]". */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
