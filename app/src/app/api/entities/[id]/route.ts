import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { canonicalizeUrl } from "@pipeline/dedup";

export const runtime = "nodejs";

/**
 * PATCH /api/entities/[id] — targeted profile updates from the Monitoring view:
 *   { notifications: { email?, webhook? } }  — toggle notification channels
 *   { add_seed_url: "https://…" }            — add a custom source; also inserts a
 *                                              sources row so the count updates now
 *                                              and the next crawl picks it up.
 * Read-merge-write on the profile jsonb; both fields optional, at least one required.
 */
const BodySchema = z
  .object({
    notifications: z
      .object({ email: z.boolean().optional(), webhook: z.boolean().optional() })
      .optional(),
    add_seed_url: z.string().url().optional(),
  })
  .refine((b) => b.notifications !== undefined || b.add_seed_url !== undefined, {
    message: "provide notifications and/or add_seed_url",
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

  const db = supabaseAdmin();
  const { data: entity, error: selErr } = await db
    .from("entities")
    .select("id, profile")
    .eq("id", id)
    .maybeSingle();
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });
  if (!entity) return NextResponse.json({ error: "entity not found" }, { status: 404 });

  const profile = (entity.profile ?? {}) as Record<string, unknown>;

  if (parsed.notifications) {
    const current = (profile.notifications ?? { email: true, webhook: false }) as Record<string, boolean>;
    profile.notifications = { ...current, ...parsed.notifications };
  }

  if (parsed.add_seed_url) {
    const urls = new Set<string>((profile.seed_urls as string[]) ?? []);
    urls.add(parsed.add_seed_url);
    profile.seed_urls = [...urls];

    // Insert a sources row so the dashboard count bumps immediately; the pipeline's
    // seedSources is idempotent, so a duplicate insert race is tolerated. Canonicalize
    // to match seedSources so the same URL added two ways doesn't create a visible dup.
    const { error: srcErr } = await db
      .from("sources")
      .insert({ entity_id: id, kind: "website", url: canonicalizeUrl(parsed.add_seed_url) });
    if (srcErr && !/duplicate key/i.test(srcErr.message)) {
      return NextResponse.json({ error: srcErr.message }, { status: 500 });
    }
  }

  const { error: updErr } = await db
    .from("entities")
    .update({ profile, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ id, profile });
}
