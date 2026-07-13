"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LeadCandidate, LeadCandidateStatus } from "@/app/types";

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? fallback);
  return res.json();
}

export interface LeadCandidatesPage {
  candidates: LeadCandidate[];
  total: number;
  page: number;
  pageSize: number;
}

/** New-lead discovery inbox, server-paginated. */
export function useLeadCandidates(params: {
  status?: LeadCandidateStatus | "all";
  page: number;
  pageSize?: number;
}) {
  const { status = "proposed", page, pageSize = 5 } = params;
  return useQuery({
    queryKey: ["lead-candidates", status, page, pageSize],
    queryFn: async (): Promise<LeadCandidatesPage> => {
      const q = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) });
      return jsonOrThrow(await fetch(`/api/lead-candidates?${q}`), "Failed to load lead candidates");
    },
  });
}

/** One-click "Add to watchlist": creates the entity + fires its first cycle. */
export function useAddCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      jsonOrThrow<{ candidate_id: string; entity_id: string; ingest_key: string }>(
        await fetch(`/api/lead-candidates/${id}/add`, { method: "POST" }),
        "Failed to add to watchlist",
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-candidates"] });
      qc.invalidateQueries({ queryKey: ["monitoring"] });
    },
  });
}

/** Dismiss a discovered lead (it won't be re-proposed). */
export function useDismissCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      jsonOrThrow<{ id: string; status: string }>(
        await fetch(`/api/lead-candidates/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "dismissed" }),
        }),
        "Failed to dismiss candidate",
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-candidates"] }),
  });
}
