import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/lead-candidates?status=&page=&pageSize= — the new-lead discovery
 * inbox: entities mentioned alongside watched accounts, most recently seen
 * first, joined with the watched entity that surfaced them.
 */
const QuerySchema = z.object({
  status: z.enum(["proposed", "added", "dismissed", "all"]).default("proposed"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(5),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid query", issues: parsed.error.issues }, { status: 400 });
  }
  const { status, page, pageSize } = parsed.data;

  let q = supabaseAdmin()
    .from("lead_candidates")
    .select(
      "id, name, type, relationship, reason, evidence, status, mention_count, " +
        "first_seen_at, last_seen_at, source_entity_id, added_entity_id, " +
        "source_entity:entities!lead_candidates_source_entity_id_fkey(name)",
      { count: "exact" },
    )
    .order("last_seen_at", { ascending: false });
  if (status !== "all") q = q.eq("status", status);

  const from = (page - 1) * pageSize;
  const { data, count, error } = await q.range(from, from + pageSize - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ candidates: data ?? [], total: count ?? 0, page, pageSize });
}
