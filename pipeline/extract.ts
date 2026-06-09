import { nebius } from "./clients.js";
import { config } from "./config.js";
import {
  ClassificationSchema,
  ExtractionSchema,
  SIGNAL_TYPES,
  type Classification,
  type EntityInput,
  type Insight,
} from "./schemas.js";
import type { CrawledPage } from "./crawl.js";

/** Token-free chunker: split on paragraph boundaries up to a char budget. */
export function chunkText(text: string, maxChars = config.tuning.maxCharsPerChunk): string[] {
  if (text.length <= maxChars) return [text];
  // Split oversized paragraphs first so no single piece exceeds the budget.
  const paras = text.split(/\n{2,}/).flatMap((p) => {
    if (p.length <= maxChars) return [p];
    const slices: string[] = [];
    for (let i = 0; i < p.length; i += maxChars) slices.push(p.slice(i, i + maxChars));
    return slices;
  });
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    if (buf.length + p.length + 2 > maxChars && buf) {
      chunks.push(buf);
      buf = "";
    }
    buf += (buf ? "\n\n" : "") + p;
  }
  if (buf) chunks.push(buf);
  return chunks;
}

const CLASSIFICATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_relevant", "is_about_entity", "published_at", "recency", "actionability_score", "reason"],
  properties: {
    is_relevant: { type: "boolean" },
    is_about_entity: { type: "boolean" },
    published_at: { type: ["string", "null"] },
    recency: { type: "string", enum: ["recent", "stale", "unknown"] },
    actionability_score: { type: "number" },
    reason: { type: "string" },
  },
} as const;

const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["insights"],
  properties: {
    insights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "signal_type",
          "headline",
          "summary",
          "why_it_matters",
          "recommended_action",
          "urgency",
          "confidence",
          "actionable",
          "evidence",
        ],
        properties: {
          signal_type: { type: "string", enum: [...SIGNAL_TYPES] },
          headline: { type: "string" },
          summary: { type: "string" },
          why_it_matters: { type: "string" },
          recommended_action: { type: "string" },
          urgency: { type: "string", enum: ["High", "Medium", "Low"] },
          confidence: { type: "number" },
          actionable: { type: "boolean" },
          evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["source_url", "published_at", "excerpt"],
              properties: {
                source_url: { type: "string" },
                published_at: { type: ["string", "null"] },
                excerpt: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

async function structuredCall<T>(
  system: string,
  user: string,
  schemaName: string,
  jsonSchema: object,
  parse: (raw: unknown) => T,
): Promise<T> {
  if (process.env.DEBUG_LLM) {
    const m = user.match(/\nContent:\n([\s\S]*)$/);
    const contentPart = m ? m[1] : "(no Content: marker)";
    console.error(
      `      [llm:${schemaName}] user.len=${user.length} contentPart.len=${contentPart.length} ` +
        `head="${contentPart.slice(0, 60).replace(/\n/g, " ")}"`,
    );
  }
  const res = await nebius().chat.completions.create({
    model: config.nebius.model,
    temperature: 0,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: schemaName, strict: true, schema: jsonSchema },
    } as never,
  });
  const content = res.choices[0]?.message?.content ?? "{}";
  if (process.env.DEBUG_LLM) {
    console.error(`      [llm:${schemaName}] finish=${res.choices[0]?.finish_reason} raw.len=${content.length}`);
  }
  return parse(JSON.parse(content));
}

/**
 * Cheap classification pass: is this page relevant + actually about the entity,
 * and how recent is it? Filters out stale/off-topic content before extraction.
 */
export async function classify(entity: EntityInput, page: CrawledPage): Promise<Classification> {
  const today = new Date().toISOString().slice(0, 10);
  const windowDays = config.tuning.recencyWindowDays;
  const system =
    `You classify one web page for a sales-intelligence monitor tracking ${entity.type} ${entity.name}. ` +
    `Today is ${today}. Set is_relevant=true unless the page is an error/blocked/empty/navigation-only stub; ` +
    `is_about_entity=true if the target is a primary subject (not merely mentioned in passing); ` +
    `recency="recent" if published within ${windowDays} days of today, "stale" if older, "unknown" if no date; ` +
    `actionability_score 0..1 = how much concrete, actionable sales intelligence about the target the page holds ` +
    `(hiring/funding/expansion/partnerships/exec changes/product launches/pain points; 0 = none, 0.5 = one usable ` +
    `signal, 1 = dense with fresh specific signals); reason = one short sentence. Judge only the supplied content. ` +
    `Return strict JSON.`;
  const user =
    `Target ${entity.type}: ${entity.name}` +
    (entity.company ? ` (${entity.company})` : "") +
    `\nMetadata published date hint: ${page.publishedAt ?? "none"}\n` +
    `URL: ${page.url}\nTitle: ${page.title ?? "n/a"}\n\nContent:\n${page.markdown.slice(0, 6000)}`;
  return structuredCall(system, user, "classify", CLASSIFICATION_JSON_SCHEMA, (raw) =>
    ClassificationSchema.parse(raw),
  );
}

/**
 * Extraction pass: pull 0..n actionable signals from the page as structured
 * insights. Runs per chunk and concatenates.
 */
export async function extract(entity: EntityInput, page: CrawledPage): Promise<Insight[]> {
  const system =
    `You extract actionable sales signals about a specific ${entity.type} from web content. ` +
    `Only output signals that are genuinely insightful and actionable for a salesperson — ` +
    `no filler, no generic background. ` +
    `CRITICAL ANTI-FABRICATION RULES: Use ONLY facts stated in the supplied content. Never invent ` +
    `companies, people, numbers, dates, or events. Every evidence excerpt MUST be copied VERBATIM ` +
    `(an exact substring) from the supplied content — do not paraphrase, summarize, or rephrase the ` +
    `excerpt. The signal must be about the target ${entity.type} (${entity.name}), not some unrelated ` +
    `third party mentioned in passing. If the content contains no genuine, verifiable signal about the ` +
    `target, return an empty insights array. It is correct and expected to return zero insights. ` +
    `Return strict JSON.`;
  const out: Insight[] = [];
  for (const chunk of chunkText(page.markdown)) {
    const user =
      `Target ${entity.type}: ${entity.name}` +
      (entity.company ? ` (${entity.company})` : "") +
      `\nSource URL: ${page.url}\nPublished: ${page.publishedAt ?? "unknown"}\n\nContent:\n${chunk}`;
    const result = await structuredCall(system, user, "extract", EXTRACTION_JSON_SCHEMA, (raw) =>
      ExtractionSchema.parse(raw),
    );
    out.push(...result.insights);
  }
  return out;
}
