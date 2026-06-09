import "server-only";

/**
 * Fire the Trigger.dev `bootstrap-entity` task for a newly-stored entity so its
 * first monitoring cycle runs immediately (instead of waiting for the hourly cron).
 * The task lives in ../../../trigger/bootstrap-entity.ts and reuses the pipeline.
 *
 * Payload shape matches what the task expects (a Supabase-webhook-style record),
 * so the same task serves both this explicit trigger and an optional DB webhook.
 *
 * If TRIGGER_SECRET_KEY is unset (pure-local without a worker), we skip triggering
 * and return null — the entity row still exists, and `npx trigger.dev dev` (or the
 * hourly cron once deployed) will process it. The UI never hard-fails on this.
 */
export interface BootstrapRecord {
  type: "person" | "company";
  name: string;
  ingest_key: string;
  profile?: Record<string, unknown>;
}

export async function triggerBootstrap(
  record: BootstrapRecord,
): Promise<{ id: string } | null> {
  if (!process.env.TRIGGER_SECRET_KEY) {
    console.warn(
      "[trigger] TRIGGER_SECRET_KEY not set — skipping bootstrap-entity. " +
        "Run `npx trigger.dev dev` (repo root) to process the entity, or wait for the cron.",
    );
    return null;
  }
  // Imported lazily so the SDK isn't required when triggering is disabled.
  const { tasks } = await import("@trigger.dev/sdk/v3");
  const handle = await tasks.trigger("bootstrap-entity", { record });
  return { id: handle.id };
}
