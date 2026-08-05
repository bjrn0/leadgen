import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * GET /api/entities/[id]/jobs — the open roles collected for a monitored account
 * from its careers surfaces (job_postings). Powers the Open Roles panel in the
 * Monitoring view; the summarized `hiring` insight stays in the Evidence Timeline
 * unchanged. Open roles only, freshest first (posted date, then last seen).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { data, error } = await supabaseAdmin()
    .from("job_postings")
    .select("id, title, department, location, remote, seniority, employment_type, url, posted_at, status")
    .eq("entity_id", id)
    .eq("status", "open")
    .order("posted_at", { ascending: false, nullsFirst: false })
    .order("last_seen_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}
