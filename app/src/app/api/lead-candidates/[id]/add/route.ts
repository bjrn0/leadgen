import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { upsertEntityAndBootstrap } from "@/lib/entities-server";

export const runtime = "nodejs";

/**
 * POST /api/lead-candidates/[id]/add — one-click "Add to watchlist" for a
 * discovered lead: creates the entity (same shared upsert+bootstrap as the Add
 * Account form, so its first monitoring cycle fires immediately) and marks the
 * candidate added with a link to the new entity.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = supabaseAdmin();

  const { data: candidate, error: selErr } = await db
    .from("lead_candidates")
    .select("id, name, type, relationship, reason, status")
    .eq("id", id)
    .maybeSingle();
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });
  if (!candidate) return NextResponse.json({ error: "candidate not found" }, { status: 404 });
  if (candidate.status === "added") {
    return NextResponse.json({ error: "candidate already added" }, { status: 409 });
  }

  try {
    const entity = await upsertEntityAndBootstrap({
      type: candidate.type as "person" | "company",
      name: candidate.name,
      seed_urls: [],
      cadence: "0 * * * *",
      notifications: { email: true, webhook: false },
    });

    const { error: updErr } = await db
      .from("lead_candidates")
      .update({ status: "added", added_entity_id: entity.id })
      .eq("id", id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json(
      { candidate_id: id, entity_id: entity.id, ingest_key: entity.ingest_key, run_id: entity.run_id },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
