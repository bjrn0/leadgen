import { defineConfig } from "@trigger.dev/sdk/v3";

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
});
