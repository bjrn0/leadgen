import type OpenAI from "openai";
import { DraftSchema, type Draft } from "./schemas.js";
import { normalizeForMatch } from "./quality.js";

/**
 * Outreach draft generation for one opportunity. PURE by design: the OpenAI
 * client, model, and temperature are injected so this module has zero runtime
 * imports beyond zod — the Next.js API route uses its own client
 * (app/src/lib/nebius.ts) without bundling pipeline/clients.ts (dotenv,
 * playwright, firecrawl), and the stage runner injects pipeline/clients.ts:nebius().
 *
 * Grounding contract: the model returns facts_used — the verbatim evidence
 * excerpts it relied on. verifyGrounding() checks each against the supplied
 * evidence in code; a failed check flags the draft `grounded: false` (the UI
 * shows a warning badge, the draft stays editable).
 */

export interface DraftEntity {
  type: string;
  name: string;
  title?: string | null;
  company?: string | null;
  region?: string | null;
}

export interface DraftEvidence {
  source_url: string;
  published_at?: string | null;
  excerpt: string;
}

export interface DraftInsight {
  headline: string;
  summary?: string | null;
  why_it_matters?: string | null;
  recommended_action?: string | null;
  signal_type?: string | null;
  published_at?: string | null;
  evidence: DraftEvidence[];
}

export interface DraftParams {
  entity: DraftEntity;
  insight: DraftInsight;
  model: string;
  temperature?: number;
}

export const DRAFT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "body", "facts_used"],
  properties: {
    subject: { type: "string" },
    body: { type: "string" },
    facts_used: { type: "array", items: { type: "string" } },
  },
} as const;

export function buildDraftPrompt(entity: DraftEntity, insight: DraftInsight): {
  system: string;
  user: string;
} {
  const system =
    `You write ONE short cold outbound email from a B2B engineering-services salesperson to a prospect. ` +
    `GROUNDING RULES: base the email ONLY on the trigger event and evidence excerpts supplied — never invent ` +
    `names, numbers, products, meetings, or shared history. No bracketed placeholders except the greeting name. ` +
    `Reference the trigger event specifically within the first two sentences. ` +
    `TONE: direct, peer-to-peer, specific; no flattery, no "I hope this finds you well", no exclamation marks. ` +
    `LENGTH: body 90-150 words ending with one low-friction call to action; subject line under 60 characters, ` +
    `specific to the event (not "Quick question"). ` +
    `facts_used = the exact evidence excerpts (copied VERBATIM from the supplied evidence) you relied on. ` +
    `Return strict JSON {subject, body, facts_used}.`;

  const evidenceBlock = insight.evidence
    .map(
      (e, i) =>
        `Evidence ${i + 1} (${e.source_url}${e.published_at ? `, ${e.published_at}` : ""}):\n"${e.excerpt}"`,
    )
    .join("\n\n");

  const user =
    `Prospect: ${entity.name} (${entity.type})` +
    (entity.title ? `\nTitle: ${entity.title}` : "") +
    (entity.company ? `\nCompany: ${entity.company}` : "") +
    (entity.region ? `\nRegion: ${entity.region}` : "") +
    `\n\nTrigger event (${insight.signal_type ?? "signal"}${insight.published_at ? `, ${insight.published_at}` : ""}): ${insight.headline}` +
    (insight.summary ? `\nSummary: ${insight.summary}` : "") +
    (insight.why_it_matters ? `\nWhy it matters: ${insight.why_it_matters}` : "") +
    (insight.recommended_action ? `\nSuggested angle: ${insight.recommended_action}` : "") +
    `\n\n${evidenceBlock || "Evidence: (none supplied)"}`;

  return { system, user };
}

/** Every claimed fact must substring-match the supplied evidence (verbatim, modulo case/whitespace). */
export function verifyGrounding(draft: Draft, evidence: DraftEvidence[]): boolean {
  if (draft.facts_used.length === 0) return false;
  const hay = normalizeForMatch(evidence.map((e) => e.excerpt).join("\n"));
  return draft.facts_used.every((fact) => {
    const needle = normalizeForMatch(fact);
    return needle.length >= 10 && hay.includes(needle.slice(0, 80));
  });
}

export interface GeneratedDraft extends Draft {
  grounded: boolean;
  model: string;
}

export async function generateDraft(client: OpenAI, params: DraftParams): Promise<GeneratedDraft> {
  const { system, user } = buildDraftPrompt(params.entity, params.insight);
  const res = await client.chat.completions.create({
    model: params.model,
    temperature: params.temperature ?? 0.4,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "draft", strict: true, schema: DRAFT_JSON_SCHEMA },
    } as never,
  });
  const draft = DraftSchema.parse(JSON.parse(res.choices[0]?.message?.content ?? "{}"));
  return {
    ...draft,
    grounded: verifyGrounding(draft, params.insight.evidence),
    model: params.model,
  };
}
