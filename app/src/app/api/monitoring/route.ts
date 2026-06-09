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
  const { data, error } = await supabaseAdmin()
    .from("v_monitoring_accounts")
    .select("*")
    .order("latest", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ accounts: data ?? [] });
}
