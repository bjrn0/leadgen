import { NextResponse } from "next/server";
import { runMonitorCycle } from "@pipeline/cycles";

export const runtime = "nodejs";
// Crawl + LLM per due entity; cycle self-throttles via monitoring_interval_hours.
export const maxDuration = 300;

/**
 * GET /api/cron/monitor — Vercel Cron entrypoint for the hourly monitor cycle
 * (vercel.json). Same body as the trigger.dev `monitor-cycle` task; the cycle
 * itself decides which entities are due, so double-scheduling is harmless.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runMonitorCycle());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
