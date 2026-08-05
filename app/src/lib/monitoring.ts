"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JobPosting, MonitoringAccount } from "@/app/types";

/** Read the watchlist. Pass a poll interval (ms) to refetch while a run is in flight. */
export function useMonitoring(refetchInterval: number | false = false) {
  return useQuery({
    queryKey: ["monitoring"],
    refetchInterval,
    queryFn: async (): Promise<MonitoringAccount[]> => {
      const res = await fetch("/api/monitoring");
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Failed to load monitoring");
      const json = (await res.json()) as { accounts: MonitoringAccount[] };
      return json.accounts ?? [];
    },
  });
}

/**
 * Open roles for one account (job_postings). Powers the Open Roles panel; pass
 * `enabled` false to skip the fetch for accounts that have no open roles.
 */
export function useEntityJobs(entityId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["entity-jobs", entityId],
    enabled: Boolean(entityId) && enabled,
    queryFn: async (): Promise<JobPosting[]> => {
      const res = await fetch(`/api/entities/${entityId}/jobs`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Failed to load open roles");
      const json = (await res.json()) as { jobs: JobPosting[] };
      return json.jobs ?? [];
    },
  });
}

export interface CreateEntityInput {
  type: "person" | "company";
  name: string;
  tier?: string;
  region?: string;
  seed_urls?: string[];
  notifications?: { email: boolean; webhook: boolean };
}

/**
 * Targeted profile updates: toggle notification channels or add a custom seed
 * URL. Optimistically updates the watchlist cache for instant toggle feedback.
 */
export function useUpdateEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      notifications?: { email?: boolean; webhook?: boolean };
      add_seed_url?: string;
    }): Promise<{ id: string }> => {
      const { id, ...body } = input;
      const res = await fetch(`/api/entities/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Failed to update account");
      return res.json();
    },
    onMutate: async (input) => {
      if (!input.notifications) return;
      await qc.cancelQueries({ queryKey: ["monitoring"] });
      const previous = qc.getQueryData<MonitoringAccount[]>(["monitoring"]);
      qc.setQueryData<MonitoringAccount[]>(["monitoring"], (accounts) =>
        (accounts ?? []).map((a) =>
          a.id === input.id
            ? { ...a, notifications: { ...a.notifications, ...input.notifications } }
            : a,
        ),
      );
      return { previous };
    },
    onError: (_err, _input, context) => {
      const ctx = context as { previous?: MonitoringAccount[] } | undefined;
      if (ctx?.previous) qc.setQueryData(["monitoring"], ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["monitoring"] }),
  });
}

/** Store an entity and kick off its first monitoring cycle. Invalidates the watchlist. */
export function useAddEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEntityInput): Promise<{ id: string; ingest_key: string }> => {
      const res = await fetch("/api/entities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Failed to add account");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitoring"] }),
  });
}
