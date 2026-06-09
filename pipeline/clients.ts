import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import FirecrawlApp from "@mendable/firecrawl-js";
import Browserbase from "@browserbasehq/sdk";
import { config } from "./config.js";

/**
 * Lazily-constructed singletons. Lazy so that importing a module (e.g. in tests
 * or typecheck) doesn't require every env var to be present.
 */

let _supabase: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(config.supabase.url(), config.supabase.serviceRoleKey(), {
      auth: { persistSession: false },
    });
  }
  return _supabase;
}

let _nebius: OpenAI | null = null;
/** Nebius Token Factory is OpenAI-compatible — reuse the OpenAI SDK. */
export function nebius(): OpenAI {
  if (!_nebius) {
    _nebius = new OpenAI({ apiKey: config.nebius.apiKey(), baseURL: config.nebius.baseUrl });
  }
  return _nebius;
}

let _firecrawl: FirecrawlApp | null = null;
export function firecrawl(): FirecrawlApp {
  if (!_firecrawl) {
    _firecrawl = new FirecrawlApp({ apiKey: config.firecrawl.apiKey() });
  }
  return _firecrawl;
}

let _browserbase: Browserbase | null = null;
export function browserbase(): Browserbase {
  if (!_browserbase) {
    _browserbase = new Browserbase({ apiKey: config.browserbase.apiKey });
  }
  return _browserbase;
}
