import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { nebius, nebiusModel } from "@/lib/nebius";
import {
  computeHotness,
  icpIsMeaningful,
  scoreIcpFit,
  type IcpRow,
} from "@pipeline/icp";

/**
 * Re-score currently-open opportunities and proposed lead candidates against the
 * active ICP so that defining/editing the ICP immediately re-ranks what's already
 * in the queue. Bounded (newest first) to keep the PUT /api/icp latency sane.
 * Shares the exact same scorer (@pipeline/icp) as the pipeline and stage runner.
 */
const RESCORE_CAP = 50;

export async function rescoreOpenRows(icp: IcpRow): Promise<{ opportunities: number; candidates: number }> {
  if (!icpIsMeaningful(icp)) return { opportunities: 0, candidates: 0 };
  const db = supabaseAdmin();
  const model = nebiusModel();
  const client = nebius();

  // Opportunities (status new/contacted), newest first.
  const { data: opps } = await db
    .from("opportunities")
    .select("id, signal_type, score, entities(name, type), insights(headline, summary, why_it_matters)")
    .in("status", ["new", "contacted"])
    .order("created_at", { ascending: false })
    .limit(RESCORE_CAP);

  let oppCount = 0;
  for (const o of (opps ?? []) as unknown as OppRescoreRow[]) {
    const entity = Array.isArray(o.entities) ? o.entities[0] : o.entities;
    const ins = Array.isArray(o.insights) ? o.insights[0] : o.insights;
    if (!entity) continue;
    const fit = await scoreIcpFit(client, model, {
      icp,
      subject: {
        name: entity.name,
        type: entity.type,
        signal_type: o.signal_type,
        context: [ins?.headline, ins?.summary, ins?.why_it_matters].filter(Boolean).join(" — "),
      },
    });
    const hotness = computeHotness(fit.fit, o.score ?? 0);
    await db
      .from("opportunities")
      .update({ icp_fit: fit.fit, icp_fit_reason: fit.reason, hotness })
      .eq("id", o.id);
    oppCount++;
  }

  // Proposed candidates, newest first.
  const { data: cands } = await db
    .from("lead_candidates")
    .select("id, name, type, relationship, reason")
    .eq("status", "proposed")
    .order("last_seen_at", { ascending: false })
    .limit(RESCORE_CAP);

  let candCount = 0;
  for (const c of (cands ?? []) as CandRescoreRow[]) {
    const fit = await scoreIcpFit(client, model, {
      icp,
      subject: {
        name: c.name,
        type: c.type,
        context: `${c.relationship ?? "mentioned"}: ${c.reason ?? ""}`,
      },
    });
    const hotness = computeHotness(fit.fit, 50);
    await db
      .from("lead_candidates")
      .update({ icp_fit: fit.fit, icp_fit_reason: fit.reason, hotness })
      .eq("id", c.id);
    candCount++;
  }

  return { opportunities: oppCount, candidates: candCount };
}

interface OppRescoreRow {
  id: string;
  signal_type: string | null;
  score: number | null;
  entities: { name: string; type: string } | { name: string; type: string }[] | null;
  insights:
    | { headline: string; summary: string | null; why_it_matters: string | null }
    | { headline: string; summary: string | null; why_it_matters: string | null }[]
    | null;
}

interface CandRescoreRow {
  id: string;
  name: string;
  type: string;
  relationship: string | null;
  reason: string | null;
}
