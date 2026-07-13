import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * PATCH /api/lead-candidates/[id] — dismiss (or re-propose) a discovered lead.
 * Adding to the watchlist goes through POST /api/lead-candidates/[id]/add instead.
 */
const BodySchema = z.object({
  status: z.enum(["proposed", "dismissed"]),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let parsed;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid body", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("lead_candidates")
    .update({ status: parsed.status })
    .eq("id", id)
    .select("id, status")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "candidate not found" }, { status: 404 });
  return NextResponse.json(data);
}
