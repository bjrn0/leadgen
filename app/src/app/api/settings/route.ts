import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/settings — the singleton runtime settings row.
 * PATCH /api/settings — update cadence / engines / thresholds. The pipeline reads
 *                       these at the start of every cycle (pipeline/settings.ts).
 */
const Body = z
  .object({
    monitoring_interval_hours: z.coerce.number().int().min(1).max(168),
    discovery_interval_hours: z.coerce.number().int().min(1).max(720),
    browserbase_fallback: z.boolean(),
    search_results_per_query: z.coerce.number().int().min(1).max(20),
    min_lead_fit: z.coerce.number().int().min(0).max(100),
    min_insight_confidence: z.coerce.number().min(0).max(1),
    dedup_similarity_threshold: z.coerce.number().min(0).max(1),
    min_classify_score: z.coerce.number().min(0).max(1),
  })
  .partial();

export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db.from("settings").select("*").eq("id", 1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (data) return NextResponse.json({ settings: data });

  // Self-heal: the singleton row is seeded by migration 0005, but create it on
  // demand so the Settings tab works even if the seed hasn't run.
  const { data: created, error: insErr } = await db
    .from("settings")
    .insert({ id: 1 })
    .select("*")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ settings: created });
}

export async function PATCH(req: Request) {
  let body;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid body", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("settings")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
