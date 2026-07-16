import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always read live monitoring state

/**
 * GET /api/monitoring — the watchlist, already in the dashboard's `accounts` shape
 * (id, name, tier, urgency, score, sources, latest, notifications, summary, signals[]).
 * Backed by the v_monitoring_accounts view (supabase/migrations/0001_init.sql).
 */
export async function GET() {
  // Rank by ICP fit (hotness) first — the strongest-fit accounts sit at the top,
  // same ordering principle as the lead-gen queue — then by most-recent signal.
  const { data, error } = await supabaseAdmin()
    .from("v_monitoring_accounts")
    .select("*")
    .order("hotness", { ascending: false, nullsFirst: false })
    .order("latest", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const accounts = data ?? [];

  // v_monitoring_accounts only carries a source COUNT. Attach the actual source
  // rows so the detail panel can list each account's custom sources (URLs).
  const ids = accounts.map((a: { id: string }) => a.id);
  const byEntity = new Map<string, { id: string; url: string | null; kind: string; enabled: boolean }[]>();
  if (ids.length > 0) {
    const { data: sources } = await supabaseAdmin()
      .from("sources")
      .select("id, entity_id, url, kind, enabled")
      .in("entity_id", ids);
    for (const s of sources ?? []) {
      const list = byEntity.get(s.entity_id) ?? [];
      list.push({ id: s.id, url: s.url, kind: s.kind, enabled: s.enabled });
      byEntity.set(s.entity_id, list);
    }
  }

  const withSources = accounts.map((a: { id: string }) => ({
    ...a,
    source_urls: byEntity.get(a.id) ?? [],
  }));

  return NextResponse.json({ accounts: withSources });
}
