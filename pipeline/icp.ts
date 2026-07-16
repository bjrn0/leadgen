import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { IcpFitSchema, type IcpFit, type IcpProfile } from "./schemas.js";

/**
 * ICP fit scoring — the anchor that makes ranking mean something to the user.
 * Given the active Ideal Customer Profile (what they sell + who they target) and
 * a prospect (an entity plus its trigger signal or discovery relationship), an
 * LLM judge returns a 0–100 fit with a one-sentence reason. `hotness` (1–5),
 * derived from that fit and the signal strength, is what the UI shows instead of
 * the raw number.
 *
 * PURE by design (client injected, like outreach.ts) so the Next.js API can score
 * fit without bundling pipeline/clients.ts (dotenv, firecrawl, playwright).
 */

export interface IcpRow extends IcpProfile {
  id: string;
  is_active: boolean;
}

/** The active ICP profile, or null if the user hasn't defined one yet. */
export async function loadActiveIcp(db: SupabaseClient): Promise<IcpRow | null> {
  const { data, error } = await db
    .from("icp_profiles")
    .select(
      "id, name, is_active, offering, verticals, buyer_roles, company_sizes, regions, keywords, technologies, pain_themes",
    )
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as IcpRow) ?? null;
}

/** True when the ICP actually constrains anything (else fit scoring is meaningless). */
export function icpIsMeaningful(icp: IcpProfile | null | undefined): boolean {
  if (!icp) return false;
  return Boolean(
    icp.offering?.trim() ||
      icp.verticals.length ||
      icp.buyer_roles.length ||
      icp.keywords.length ||
      icp.technologies.length ||
      icp.pain_themes.length,
  );
}

export interface FitSubject {
  name: string;
  type: string; // person | company
  signal_type?: string | null;
  context: string; // insight summary/why_it_matters, or the candidate relationship + reason
}

const FIT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fit", "reason"],
  properties: {
    fit: { type: "number" },
    reason: { type: "string" },
  },
} as const;

function icpBlock(icp: IcpProfile): string {
  const line = (label: string, v: string[] | string | undefined) => {
    if (!v) return "";
    const s = Array.isArray(v) ? v.join(", ") : v;
    return s.trim() ? `\n${label}: ${s}` : "";
  };
  return (
    `We sell: ${icp.offering?.trim() || "(unspecified)"}` +
    line("Target verticals", icp.verticals) +
    line("Target buyer roles", icp.buyer_roles) +
    line("Target company sizes", icp.company_sizes) +
    line("Target regions", icp.regions) +
    line("Keywords", icp.keywords) +
    line("Technologies", icp.technologies) +
    line("Pain themes we solve", icp.pain_themes)
  );
}

/**
 * Score how well a prospect fits the ICP for cold outbound. Rewards genuine
 * vertical / buyer-role / pain-theme overlap; penalizes wrong buyer scale (a
 * global CEO who'd never engage a mid-market vendor), wrong vertical, or no
 * plausible need for the offering — which is exactly why a bare "Elon Musk"
 * scores low for an engineering-services seller.
 */
export async function scoreIcpFit(
  client: OpenAI,
  model: string,
  args: { icp: IcpProfile; subject: FitSubject; temperature?: number },
): Promise<IcpFit> {
  const { icp, subject } = args;
  const system =
    `You score how well a prospect fits a seller's Ideal Customer Profile (ICP) for COLD OUTBOUND. ` +
    `Return fit 0–100 and one sentence naming the specific overlap or mismatch. ` +
    `Reward direct overlap on vertical, buyer role, and pain themes we solve, at a company scale where ` +
    `this seller could realistically win the deal. ` +
    `Penalize hard: wrong vertical, no plausible need for our offering, or wrong buyer scale — e.g. a ` +
    `world-famous CEO or a trillion-dollar company that would never take a meeting with a mid-market ` +
    `vendor should score LOW even if the news signal is big. A large newsworthy event about a bad-fit ` +
    `prospect is still a bad lead. Judge fit to US, not how important the prospect is. Return strict JSON.`;
  const user =
    `ICP:\n${icpBlock(icp)}\n\n` +
    `Prospect: ${subject.name} (${subject.type})` +
    (subject.signal_type ? `\nTrigger signal: ${subject.signal_type}` : "") +
    `\nContext: ${subject.context}`;

  const res = await client.chat.completions.create({
    model,
    temperature: args.temperature ?? 0,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "icp_fit", strict: true, schema: FIT_JSON_SCHEMA },
    } as never,
  });
  const parsed = IcpFitSchema.parse(JSON.parse(res.choices[0]?.message?.content ?? "{}"));
  return { fit: Math.min(100, Math.max(0, Math.round(parsed.fit))), reason: parsed.reason };
}

/**
 * Hotness (1–5) — the user-facing ranking. ICP fit dominates (0.7) with signal
 * strength as a modifier (0.3); when no ICP is set, it falls back to the signal
 * score alone. Tiers: ≥80→5, 60–79→4, 40–59→3, 20–39→2, <20→1.
 */
export function computeHotness(icpFit: number | null | undefined, signalScore: number): number {
  const combined =
    icpFit == null ? signalScore : Math.round(0.7 * icpFit + 0.3 * signalScore);
  if (combined >= 80) return 5;
  if (combined >= 60) return 4;
  if (combined >= 40) return 3;
  if (combined >= 20) return 2;
  return 1;
}

const HOTNESS_LABELS_ICP: Record<number, string> = {
  5: "Strong ICP match",
  4: "Good fit",
  3: "Medium fit",
  2: "Weak fit",
  1: "Low fit",
};
const HOTNESS_LABELS_SIGNAL: Record<number, string> = {
  5: "Very high signal",
  4: "High signal",
  3: "Medium signal",
  2: "Low signal",
  1: "Faint signal",
};

/** Label for a hotness tier; wording depends on whether an ICP drove the score. */
export function hotnessLabel(tier: number, hasIcp: boolean): string {
  return (hasIcp ? HOTNESS_LABELS_ICP : HOTNESS_LABELS_SIGNAL)[tier] ?? "Unknown";
}
