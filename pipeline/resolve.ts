import type OpenAI from "openai";
import { searchPages } from "./crawl.js";
import { normalizeForMatch } from "./quality.js";
import { CompanyIdentitySchema, type CompanyIdentity } from "./schemas.js";

/**
 * Company identity resolution — the front step for vacancy collection. A lead
 * added to monitoring is created from its NAME only (seed_urls empty), so before
 * we can crawl its open roles we must resolve, from the open web, the company's
 * canonical domain and every careers surface it exposes (its own /careers page
 * and/or a Greenhouse/Lever ATS board).
 *
 * Guardrails (same anti-fabrication posture as extract/discovery): the domain
 * evidence must appear VERBATIM in a fetched page, and a confidence floor gates
 * everything — resolving the WRONG company is the worst failure (we'd track
 * another company's jobs), so we bias toward registering NO surface over a shaky
 * one. Callers treat a null return as "register no careers source".
 *
 * PURE where it matters (LLM client injected) so it runs from the Trigger.dev
 * task, the API route, or the stage runner. Firecrawl runs server-side only.
 */

const IDENTITY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["website", "careers_urls", "confidence", "evidence_excerpt"],
  properties: {
    website: { type: ["string", "null"] },
    careers_urls: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
    evidence_excerpt: { type: "string" },
  },
} as const;

export interface CareersSurface {
  url: string;
  /** Which collection path the crawler should take for this surface. */
  source: "greenhouse" | "lever" | "careers";
}

/**
 * Classify a careers URL into a collection path by pure string inspection — no
 * network call. Greenhouse/Lever get the structured public JSON API; anything
 * else is scraped. Also used by pipeline/jobs.ts to pick the adapter.
 */
export function detectAtsSource(url: string): "greenhouse" | "lever" | "careers" {
  const u = url.toLowerCase();
  if (u.includes("greenhouse.io") || u.includes("boards.greenhouse.io")) return "greenhouse";
  if (u.includes("lever.co")) return "lever";
  return "careers";
}

/**
 * Extract the board token/company slug an ATS API needs from a careers URL. Both
 * providers put it as the first path segment: boards.greenhouse.io/<token>,
 * job-boards.greenhouse.io/<token>/..., jobs.lever.co/<company>. An `embed` prefix
 * (greenhouse embedded widget) shifts the token one segment right.
 */
export function atsToken(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "embed") return parts[1] ?? null;
    return parts[0] ?? null;
  } catch {
    return null;
  }
}

const MIN_CONFIDENCE = 0.6;

/**
 * Resolve a company's careers surfaces from its name. Returns null when the
 * domain can't be resolved confidently (verbatim-grounded, above the floor) so
 * the caller registers no careers source rather than crawl the wrong company.
 */
export async function resolveCareersSurfaces(
  client: OpenAI,
  model: string,
  name: string,
  minConfidence = MIN_CONFIDENCE,
): Promise<{ website: string | null; surfaces: CareersSurface[] } | null> {
  const pages = await searchPages(
    [`${name} official website`, `${name} careers jobs openings`],
    5,
  );
  if (pages.length === 0) return null;

  const corpus = pages
    .map((p) => `Source URL: ${p.url}\nTitle: ${p.title ?? "n/a"}\n${p.markdown.slice(0, 4000)}`)
    .join("\n\n---\n\n");

  const system =
    `You resolve the official web identity of a company for a sales tool. Given search ` +
    `results, return the company's canonical website, and every careers surface where its ` +
    `open roles are listed — its own careers/jobs page AND any Greenhouse or Lever board ` +
    `(a company often uses several). careers_urls: absolute URLs only, drop duplicates and ` +
    `third-party job aggregators (Indeed, Glassdoor, LinkedIn). confidence 0..1 = how sure ` +
    `you are these belong to the target company (not a namesake). evidence_excerpt = a ` +
    `VERBATIM substring from the supplied content that names the company on its own domain. ` +
    `If you cannot identify the company confidently, set confidence low and careers_urls []. ` +
    `Return strict JSON.`;
  const user = `Company name: ${name}\n\nSearch results:\n${corpus}`;

  const res = await client.chat.completions.create({
    model,
    temperature: 0,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "company_identity", strict: true, schema: IDENTITY_JSON_SCHEMA },
    } as never,
  });
  const identity: CompanyIdentity = CompanyIdentitySchema.parse(
    JSON.parse(res.choices[0]?.message?.content ?? "{}"),
  );

  if (identity.confidence < minConfidence) return null;

  // Grounding: the evidence must actually appear in one of the fetched pages.
  const needle = normalizeForMatch(identity.evidence_excerpt);
  const grounded =
    needle.length >= 20 && pages.some((p) => normalizeForMatch(p.markdown).includes(needle.slice(0, 80)));
  if (!grounded) return null;

  const seen = new Set<string>();
  const surfaces: CareersSurface[] = [];
  for (const raw of identity.careers_urls) {
    const url = raw.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    surfaces.push({ url, source: detectAtsSource(url) });
  }
  if (surfaces.length === 0) return null;

  return { website: identity.website, surfaces };
}
