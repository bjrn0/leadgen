import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertEntityAndBootstrap } from "@/lib/entities-server";

export const runtime = "nodejs";

/**
 * POST /api/entities — store a person/company and kick off its first monitoring
 * cycle. Mirrors the contract of pipeline/schemas.ts:EntityInputSchema and the
 * upsert in pipeline/store.ts:upsertEntity, so the dashboard and the local runner
 * write identical rows. Idempotent on ingest_key (re-adding updates in place).
 * Shared upsert+bootstrap logic lives in @/lib/entities-server (also used by
 * the lead-candidate "add to watchlist" route).
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

  try {
    const result = await upsertEntityAndBootstrap(parsed);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
