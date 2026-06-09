import { config } from "./config.js";
import type { Classification, Insight } from "./schemas.js";

/** Collapse whitespace + lowercase so verbatim matching tolerates trivial reformatting. */
function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Anti-hallucination check: an insight is only trustworthy if at least one of its
 * evidence excerpts actually appears (verbatim, modulo whitespace/case) in the crawled
 * page. Fabricated insights cite quotes that were never on the page, so they fail here.
 */
export function evidenceIsGrounded(insight: Insight, sourceText: string): boolean {
  const hay = normalizeForMatch(sourceText);
  return insight.evidence.some((e) => {
    const needle = normalizeForMatch(e.excerpt ?? "");
    if (needle.length < 20) return false; // too short to verify confidently
    // Probe a leading slice so a slightly-truncated-but-real quote still matches,
    // while a wholly invented quote does not.
    return hay.includes(needle.slice(0, 80));
  });
}

/**
 * Actionability gate. Insights that fail are still stored (quality:'low') so the
 * feedback loop stays inspectable, but they're excluded from v_monitoring_accounts.
 */
export function gradeInsight(
  insight: Insight,
  classification: Classification,
  sourceText: string,
): {
  quality: "ok" | "low";
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!insight.actionable) reasons.push("not actionable");
  if (insight.confidence < config.tuning.minInsightConfidence)
    reasons.push(`confidence ${insight.confidence} < ${config.tuning.minInsightConfidence}`);
  if (!insight.recommended_action?.trim()) reasons.push("no recommended action");
  if (!insight.evidence.some((e) => e.source_url?.trim())) reasons.push("no evidence with source_url");
  if (!evidenceIsGrounded(insight, sourceText))
    reasons.push("evidence not found verbatim in source (likely fabricated)");
  if (!classification.is_about_entity) reasons.push("not about the entity");
  if (classification.recency === "stale") reasons.push("stale");
  return { quality: reasons.length === 0 ? "ok" : "low", reasons };
}
