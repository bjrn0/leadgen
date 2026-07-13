import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

/**
 * The repo root .env.local is the single source of truth for every workspace
 * (pipeline/config.ts and trigger.config.ts load it the same way). But `next`
 * runs with cwd = app/, so its built-in loader looks for app/.env.local and
 * misses the root file — hence "Supabase env missing" in API routes.
 *
 * Load the root env here, before Next builds its webpack env, so both server
 * code (process.env.*) and inlined NEXT_PUBLIC_* vars resolve correctly.
 * An app-local .env.local (if you ever add one) still wins: dotenv never
 * overrides already-set values, so we load app-local first, then root.
 */
loadEnv({ path: resolve(process.cwd(), ".env.local") }); // app/.env.local (optional override)
loadEnv({ path: resolve(process.cwd(), "..", ".env.local") }); // repo-root secrets
loadEnv({ path: resolve(process.cwd(), "..", ".env") }); // repo-root fallback

const nextConfig: NextConfig = {
  experimental: {
    // API routes import the pure pipeline modules (pipeline/outreach.ts) from
    // outside app/ — one prompt/grounding implementation for runner and API.
    externalDir: true,
  },
  webpack: (config) => {
    // The pipeline package uses nodenext-style ".js" specifiers in TS files
    // (import "./schemas.js" resolving to schemas.ts); teach webpack the same.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".js"],
    };
    return config;
  },
};

export default nextConfig;
