import { config } from "dotenv";
import { defineConfig } from "@trigger.dev/sdk";

// Load .env.local before defineConfig reads process.env (path is relative to cwd / repo root).
config({ path: ".env.local" });

/**
 * Trigger.dev project config. Tasks live in ./trigger and reuse the SAME
 * pipeline modules as the local runner. Set TRIGGER_PROJECT_REF in your env.
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_set_me",
  runtime: "node",
  logLevel: "info",
  maxDuration: 3600,
  dirs: ["./trigger"],
  build: {
    // playwright-core has optional chromium-bidi deep imports that esbuild
    // can't resolve at bundle time. Keep these as runtime requires instead.
    external: ["playwright-core", "chromium-bidi"],
  },
});
