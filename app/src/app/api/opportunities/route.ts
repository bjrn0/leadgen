import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/opportunities?status=&entity_id=&page=&pageSize=
 * The ranked lead-gen queue: opportunities joined with their entity + source
 * insight, ordered score desc. Default filter excludes dismissed. Server-side
 * pagination via range + exact count.
 */
const QuerySchema = z.object({
  status: z.enum(["new", "contacted", "qualified", "dismissed", "all"]).default("all"),
  entity_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(5),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid query", issues: parsed.error.issues }, { status: 400 });
  }
  const { status, entity_id, page, pageSize } = parsed.data;

  let q = supabaseAdmin()
    .from("opportunities")
    .select(
      "id, entity_id, insight_id, signal_type, score, status, why_now, suggested_action, created_at, updated_at, " +
        "entities(name, type, profile), " +
        "insights(headline, summary, why_it_matters, recommended_action, evidence, signal_type, urgency, confidence, published_at)",
      { count: "exact" },
    )
    .order("score", { ascending: false })
    .order("created_at", { ascending: false });

  if (status === "all") q = q.neq("status", "dismissed");
  else q = q.eq("status", status);
  if (entity_id) q = q.eq("entity_id", entity_id);

  const from = (page - 1) * pageSize;
  const { data, count, error } = await q.range(from, from + pageSize - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ opportunities: data ?? [], total: count ?? 0, page, pageSize });
}
