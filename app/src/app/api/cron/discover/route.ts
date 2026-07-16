import { NextResponse } from "next/server";
import { runDiscoveryCycle } from "@pipeline/cycles";

export const runtime = "nodejs";
// Web search + LLM extraction; cycle self-throttles via discovery_interval_hours.
export const maxDuration = 300;

/**
 * GET /api/cron/discover — Vercel Cron entrypoint for ICP discovery
 * (vercel.json). Same body as the trigger.dev `discover-leads` task; the cycle
 * itself enforces the discovery cadence, so double-scheduling is harmless.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runDiscoveryCycle());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
