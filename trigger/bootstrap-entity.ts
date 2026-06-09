import { task } from "@trigger.dev/sdk/v3";
import { EntityInputSchema } from "../pipeline/schemas.js";
import { runEntityCycle } from "../pipeline/pipeline.js";

/**
 * Target of a Supabase Database Webhook on `entities` INSERT. Supabase posts
 * { type, table, record, old_record }; we run an immediate first cycle for the
 * new entity so the user sees results without waiting for the hourly cron.
 *
 * Wiring: Supabase → Database Webhooks → HTTP Request to the Trigger.dev
 * trigger endpoint for this task (id "bootstrap-entity").
 */
interface EntityWebhookPayload {
  record?: {
    type: "person" | "company";
    name: string;
    ingest_key: string;
    profile?: Record<string, unknown>;
  };
}

export const bootstrapEntity = task({
  id: "bootstrap-entity",
  maxDuration: 1800,
  run: async (payload: EntityWebhookPayload) => {
    const record = payload.record;
    if (!record) throw new Error("bootstrap-entity: missing record in webhook payload");
    const p = record.profile ?? {};
    const input = EntityInputSchema.parse({
      type: record.type,
      name: record.name,
      ingest_key: record.ingest_key,
      title: p.title ?? undefined,
      company: p.company ?? undefined,
      region: p.region ?? undefined,
      tier: p.tier ?? undefined,
      seed_urls: p.seed_urls ?? [],
      cadence: p.cadence ?? undefined,
      notifications: p.notifications ?? undefined,
    });
    return runEntityCycle(input, "webhook");
  },
});
