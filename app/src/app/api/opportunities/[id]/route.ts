import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/opportunities/[id]   — one opportunity with entity, insight, and drafts
 *                                 (newest first).
 * PATCH /api/opportunities/[id] — { status } workflow transition
 *                                 (new/contacted/qualified/dismissed).
 */
const PatchSchema = z.object({
  status: z.enum(["new", "contacted", "qualified", "dismissed"]),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { data, error } = await supabaseAdmin()
    .from("opportunities")
    .select(
      "id, entity_id, insight_id, signal_type, score, icp_fit, icp_fit_reason, hotness, status, why_now, suggested_action, created_at, updated_at, " +
        "entities(name, type, profile), " +
        "insights(headline, summary, why_it_matters, recommended_action, evidence, signal_type, urgency, confidence, published_at), " +
        "drafts(id, subject, body, facts_used, grounded, model, edited, created_at)",
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "drafts", ascending: false })
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "opportunity not found" }, { status: 404 });
  return NextResponse.json({ opportunity: data });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let parsed;
  try {
    parsed = PatchSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid body", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("opportunities")
    .update({ status: parsed.status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, status")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "opportunity not found" }, { status: 404 });
  return NextResponse.json(data);
}
