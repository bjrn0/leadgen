import "server-only";
import OpenAI from "openai";

/**
 * Server-only Nebius client (OpenAI-compatible) for API routes that generate
 * outreach drafts. Mirrors pipeline/clients.ts:nebius() the same way
 * lib/supabase.ts mirrors pipeline/clients.ts:supabase() — the app never
 * imports pipeline/clients.ts (dotenv, firecrawl, playwright).
 */
let _client: OpenAI | null = null;

export function nebius(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.NEBIUS_API_KEY;
  if (!apiKey) {
    throw new Error("Nebius env missing: set NEBIUS_API_KEY.");
  }
  _client = new OpenAI({
    apiKey,
    baseURL: process.env.NEBIUS_BASE_URL || "https://api.studio.nebius.com/v1",
  });
  return _client;
}

export function nebiusModel(): string {
  return process.env.NEBIUS_MODEL || "Qwen/Qwen3-30B-A3B-Instruct-2507";
}
