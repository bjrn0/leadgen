"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Draft, Opportunity, OpportunityStatus } from "@/app/types";

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? fallback);
  return res.json();
}

export interface OpportunitiesPage {
  opportunities: Opportunity[];
  total: number;
  page: number;
  pageSize: number;
}

/** Ranked opportunities queue, server-paginated. status "all" = everything except dismissed. */
export function useOpportunities(params: {
  status: OpportunityStatus | "all";
  page: number;
  pageSize?: number;
  entityId?: string;
}) {
  const { status, page, pageSize = 5, entityId } = params;
  return useQuery({
    queryKey: ["opportunities", status, page, pageSize, entityId ?? null],
    queryFn: async (): Promise<OpportunitiesPage> => {
      const q = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) });
      if (entityId) q.set("entity_id", entityId);
      return jsonOrThrow(await fetch(`/api/opportunities?${q}`), "Failed to load opportunities");
    },
  });
}

/** One opportunity with its drafts (newest first). */
export function useOpportunity(id: string | null) {
  return useQuery({
    queryKey: ["opportunity", id],
    enabled: !!id,
    queryFn: async (): Promise<Opportunity & { drafts: Draft[] }> => {
      const json = await jsonOrThrow<{ opportunity: Opportunity & { drafts: Draft[] } }>(
        await fetch(`/api/opportunities/${id}`),
        "Failed to load opportunity",
      );
      return json.opportunity;
    },
  });
}

/** Workflow transition (new/contacted/qualified/dismissed). */
export function useUpdateOpportunityStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OpportunityStatus }) =>
      jsonOrThrow<{ id: string; status: OpportunityStatus }>(
        await fetch(`/api/opportunities/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        }),
        "Failed to update opportunity",
      ),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["opportunity", id] });
    },
  });
}

/** Generate a fresh outreach draft (LLM; can take ~20s). */
export function useGenerateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opportunityId: string): Promise<Draft> => {
      const json = await jsonOrThrow<{ draft: Draft }>(
        await fetch(`/api/opportunities/${opportunityId}/draft`, { method: "POST" }),
        "Draft generation failed",
      );
      return json.draft;
    },
    onSuccess: (_data, opportunityId) =>
      qc.invalidateQueries({ queryKey: ["opportunity", opportunityId] }),
  });
}

/** Save manual edits to a draft. */
export function useSaveDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, subject, body }: { id: string; subject: string; body: string }) => {
      const json = await jsonOrThrow<{ draft: Draft }>(
        await fetch(`/api/drafts/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subject, body }),
        }),
        "Failed to save draft",
      );
      return json.draft;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunity"] }),
  });
}
