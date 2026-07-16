import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { triggerBootstrap } from "@/lib/trigger";
import { seedSources } from "@pipeline/store";

/**
 * Shared entity upsert + first-cycle bootstrap. Used by POST /api/entities
 * (Add Account form) and POST /api/lead-candidates/[id]/add (one-click
 * watchlisting of a discovered lead) so both write identical rows. Mirrors
 * pipeline/store.ts:upsertEntity. Idempotent on ingest_key.
 */

export interface EntityUpsertInput {
  type: "person" | "company";
  name: string;
  title?: string;
  company?: string;
  region?: string;
  tier?: string;
  seed_urls: string[];
  cadence: string;
  notifications: { email: boolean; webhook: boolean };
}

export function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

export async function upsertEntityAndBootstrap(
  input: EntityUpsertInput,
): Promise<{ id: string; ingest_key: string; run_id: string | null }> {
  const ingest_key = `${input.type}:${slug(input.name)}`;
  const profile = {
    title: input.title ?? null,
    company: input.company ?? null,
    region: input.region ?? null,
    tier: input.tier ?? null,
    seed_urls: input.seed_urls,
    cadence: input.cadence,
    notifications: input.notifications,
  };

  const { data, error } = await supabaseAdmin()
    .from("entities")
    .upsert(
      { type: input.type, name: input.name, ingest_key, profile, updated_at: new Date().toISOString() },
      { onConflict: "ingest_key" },
    )
    .select("id, ingest_key")
    .single();
  if (error) throw new Error(error.message);

  // Persist the custom sources NOW so they show in the monitoring account's source
  // list immediately — otherwise they only appear after the first crawl runs
  // seedSources(), which never happens if the worker is offline. Idempotent.
  try {
    await seedSources(data.id, {
      type: input.type,
      name: input.name,
      ingest_key,
      seed_urls: input.seed_urls,
      cadence: input.cadence,
      notifications: input.notifications,
    });
  } catch (err) {
    console.error("[entities-server] seedSources failed:", (err as Error).message);
  }

  // Fire the first cycle immediately. Non-fatal if the worker/secret is absent.
  let triggered: { id: string } | null = null;
  try {
    triggered = await triggerBootstrap({ type: input.type, name: input.name, ingest_key, profile });
  } catch (err) {
    console.error("[entities-server] bootstrap trigger failed:", (err as Error).message);
  }

  return { id: data.id, ingest_key: data.ingest_key, run_id: triggered?.id ?? null };
}
