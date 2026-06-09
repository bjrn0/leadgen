import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/entities/[id]/runs — latest run status/stats for an entity, so the UI
 * can show "processing…" vs "done" while a bootstrap cycle is in flight.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { data, error } = await supabaseAdmin()
    .from("runs")
    .select("id, status, trigger, stats, started_at, finished_at, error")
    .eq("entity_id", id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ run: data ?? null });
}
