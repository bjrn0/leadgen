import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { nebius, nebiusModel } from "@/lib/nebius";
import { discoverFromQuery } from "@pipeline/icp-discovery";
import { applyStoredSettings } from "@pipeline/settings";
import type { IcpRow } from "@pipeline/icp";

export const runtime = "nodejs";
// Live web search + LLM extraction + fit scoring for a handful of results.
export const maxDuration = 120;

/**
 * POST /api/discover — run a user-typed lead search NOW. Searches the open web for
 * the query, extracts companies, scores them against the ICP, and adds the results
 * to New Leads (discovery_source='icp_search'). Interactive: returns the leads it
 * found. Background ICP discovery runs separately on the daily `discover-leads` cron.
 */
const BodySchema = z.object({
  query: z.string().min(2, "enter a search query"),
});

export async function POST(req: Request) {
  let body;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid body", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const db = supabaseAdmin();
  await applyStoredSettings(db);
  const { data: icp } = await db.from("icp_profiles").select("*").eq("is_active", true).maybeSingle();
  if (!icp) {
    return NextResponse.json({ error: "Define your ICP first — search results are scored against it." }, { status: 400 });
  }

  try {
    const { result, found } = await discoverFromQuery(body.query, {
      icp: icp as IcpRow,
      client: nebius(),
      model: nebiusModel(),
    });
    return NextResponse.json({
      query: body.query,
      pagesSearched: result.pagesSearched,
      proposed: result.proposed,
      found,
    });
  } catch (err) {
    return NextResponse.json({ error: `search failed: ${(err as Error).message}` }, { status: 502 });
  }
}
