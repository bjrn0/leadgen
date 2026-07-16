import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { rescoreOpenRows } from "@/lib/icp-server";
import type { IcpRow } from "@pipeline/icp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Rescore does bounded LLM calls; give it room.
export const maxDuration = 120;

/**
 * GET  /api/icp — the active Ideal Customer Profile (or null).
 * PUT  /api/icp — upsert the active ICP, then re-score currently-open
 *                 opportunities + proposed candidates so the queue re-ranks
 *                 immediately. Returns { icp, rescored }.
 */
const IcpBody = z.object({
  name: z.string().min(1).default("Default ICP"),
  offering: z.string().default(""),
  verticals: z.array(z.string()).default([]),
  buyer_roles: z.array(z.string()).default([]),
  company_sizes: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  pain_themes: z.array(z.string()).default([]),
});

export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from("icp_profiles")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ icp: data ?? null });
}

export async function PUT(req: Request) {
  let body;
  try {
    body = IcpBody.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid body", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: existing } = await db
    .from("icp_profiles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  const row = { ...body, is_active: true, updated_at: new Date().toISOString() };
  const { data: saved, error } = existing
    ? await db.from("icp_profiles").update(row).eq("id", existing.id).select("*").single()
    : await db.from("icp_profiles").insert(row).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rescored = { opportunities: 0, candidates: 0 };
  try {
    rescored = await rescoreOpenRows(saved as IcpRow);
  } catch (err) {
    // Saving the ICP must succeed even if the rescore hits an LLM hiccup.
    console.error("[api/icp] rescore failed:", (err as Error).message);
  }

  return NextResponse.json({ icp: saved, rescored });
}
