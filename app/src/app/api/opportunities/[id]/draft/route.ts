import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { nebius, nebiusModel } from "@/lib/nebius";
import { generateDraft, type DraftEvidence } from "@pipeline/outreach";

export const runtime = "nodejs";
// LLM generation can take ~20s; don't let the platform default kill it.
export const maxDuration = 60;

/**
 * POST /api/opportunities/[id]/draft — generate a grounded outreach email for
 * this opportunity and store it. Uses the same prompt + grounding verification
 * as the stage runner (pipeline/outreach.ts, pure module). Each POST creates a
 * new draft row (regenerate keeps history; the UI shows the latest).
 */
interface OppJoinRow {
  id: string;
  insight_id: string;
  entities:
    | { type: string; name: string; profile: Record<string, string | null> | null }
    | { type: string; name: string; profile: Record<string, string | null> | null }[]
    | null;
  insights:
    | Record<string, unknown>
    | Record<string, unknown>[]
    | null;
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = supabaseAdmin();

  const { data, error: oErr } = await db
    .from("opportunities")
    .select(
      "id, insight_id, entities(type, name, profile), " +
        "insights(headline, summary, why_it_matters, recommended_action, signal_type, published_at, evidence)",
    )
    .eq("id", id)
    .maybeSingle();
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "opportunity not found" }, { status: 404 });
  const opp = data as unknown as OppJoinRow;

  // Supabase types to-one joins as arrays; normalize.
  const entity = Array.isArray(opp.entities) ? opp.entities[0] : opp.entities;
  const insight = Array.isArray(opp.insights) ? opp.insights[0] : opp.insights;
  if (!entity || !insight) {
    return NextResponse.json({ error: "opportunity is missing its entity or insight" }, { status: 500 });
  }
  const profile = (entity.profile ?? {}) as Record<string, string | null>;
  const ins = insight as {
    headline: string;
    summary?: string | null;
    why_it_matters?: string | null;
    recommended_action?: string | null;
    signal_type?: string | null;
    published_at?: string | null;
    evidence?: unknown;
  };

  try {
    const draft = await generateDraft(nebius(), {
      entity: {
        type: entity.type,
        name: entity.name,
        title: profile.title,
        company: profile.company,
        region: profile.region,
      },
      insight: { ...ins, evidence: (ins.evidence ?? []) as DraftEvidence[] },
      model: nebiusModel(),
      temperature: Number(process.env.DRAFT_TEMPERATURE ?? 0.4),
    });

    const { data, error } = await db
      .from("drafts")
      .insert({
        opportunity_id: id,
        subject: draft.subject,
        body: draft.body,
        facts_used: draft.facts_used,
        grounded: draft.grounded,
        model: draft.model,
      })
      .select("id, subject, body, facts_used, grounded, model, edited, created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ draft: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: `draft generation failed: ${(err as Error).message}` }, { status: 502 });
  }
}
