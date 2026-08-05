import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { triggerBootstrap } from "@/lib/trigger";
import { seedJobSource, seedSources } from "@pipeline/store";
import { resolveCareersSurfaces, type CareersSurface } from "@pipeline/resolve";
import { nebius } from "@pipeline/clients";
import { config } from "@pipeline/config";

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

  // Resolve the company's careers surface(s) so vacancy collection has something
  // to crawl — a freshly-added lead arrives with no URLs, only a name. Non-fatal:
  // if resolution fails or is low-confidence we register no careers source
  // (better than crawling the wrong company's jobs) and the entity is still created.
  let website: string | null = null;
  let surfaces: CareersSurface[] = [];
  if (input.type === "company") {
    try {
      const resolved = await resolveCareersSurfaces(nebius(), config.nebius.model, input.name);
      if (resolved) {
        website = resolved.website;
        surfaces = resolved.surfaces;
      }
    } catch (err) {
      console.error("[entities-server] careers resolution failed:", (err as Error).message);
    }
  }

  const profile = {
    title: input.title ?? null,
    company: input.company ?? null,
    region: input.region ?? null,
    tier: input.tier ?? null,
    seed_urls: input.seed_urls,
    cadence: input.cadence,
    notifications: input.notifications,
    website,
    careers_urls: surfaces.map((s) => s.url),
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

  // Register each resolved careers surface as a 'careers' source so the first
  // cycle collects vacancies. Idempotent; non-fatal per surface.
  for (const surface of surfaces) {
    try {
      await seedJobSource(data.id, surface.url);
    } catch (err) {
      console.error("[entities-server] seedJobSource failed:", (err as Error).message);
    }
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
