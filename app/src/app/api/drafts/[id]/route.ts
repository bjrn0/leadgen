import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * PATCH /api/drafts/[id] — save the user's manual edits to a generated draft.
 * Marks edited=true so the UI can distinguish human-touched drafts.
 */
const BodySchema = z
  .object({
    subject: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
  })
  .refine((b) => b.subject !== undefined || b.body !== undefined, {
    message: "provide subject and/or body",
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
    .from("drafts")
    .update({ ...parsed, edited: true })
    .eq("id", id)
    .select("id, subject, body, facts_used, grounded, model, edited, created_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "draft not found" }, { status: 404 });
  return NextResponse.json({ draft: data });
}
