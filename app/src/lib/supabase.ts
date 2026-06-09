import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client for API routes. Uses the service-role secret key
 * (DATABASE_SECRET_KEY) so routes can read the dashboard view and insert entities
 * without RLS. Mirrors pipeline/clients.ts:supabase(). NEVER import from a client
 * component — the "server-only" guard above will error the build if you do.
 */
let _client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.DATABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL and DATABASE_SECRET_KEY (or SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}
