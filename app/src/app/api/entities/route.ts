import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { triggerBootstrap } from "@/lib/trigger";

export const runtime = "nodejs";

/**
 * POST /api/entities — store a person/company and kick off its first monitoring
 * cycle. Mirrors the contract of pipeline/schemas.ts:EntityInputSchema and the
 * upsert in pipeline/store.ts:upsertEntity, so the dashboard and the local runner
 * write identical rows. Idempotent on ingest_key (re-adding updates in place).
 */
const BodySchema = z.object({
  type: z.enum(["person", "company"]).default("company"),
  name: z.string().min(1, "name is required"),
  title: z.string().optional(),
  company: z.string().optional(),
  region: z.string().optional(),
  tier: z.string().optional(),
  seed_urls: z.array(z.string().url()).default([]),
  cadence: z.string().default("0 * * * *"),
  notifications: z
    .object({ email: z.boolean().default(true), webhook: z.boolean().default(false) })
    .default({ email: true, webhook: false }),
});

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid body", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const ingest_key = `${parsed.type}:${slug(parsed.name)}`;
  const profile = {
    title: parsed.title ?? null,
    company: parsed.company ?? null,
    region: parsed.region ?? null,
    tier: parsed.tier ?? null,
    seed_urls: parsed.seed_urls,
    cadence: parsed.cadence,
    notifications: parsed.notifications,
  };

  const { data, error } = await supabaseAdmin()
    .from("entities")
    .upsert(
      { type: parsed.type, name: parsed.name, ingest_key, profile, updated_at: new Date().toISOString() },
      { onConflict: "ingest_key" },
    )
    .select("id, ingest_key")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire the first cycle immediately. Non-fatal if the worker/secret is absent.
  let triggered: { id: string } | null = null;
  try {
    triggered = await triggerBootstrap({
      type: parsed.type,
      name: parsed.name,
      ingest_key,
      profile,
    });
  } catch (err) {
    console.error("[api/entities] bootstrap trigger failed:", (err as Error).message);
  }

  return NextResponse.json(
    { id: data.id, ingest_key: data.ingest_key, run_id: triggered?.id ?? null },
    { status: 201 },
  );
}
