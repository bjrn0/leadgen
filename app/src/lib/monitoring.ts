"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MonitoringAccount } from "@/app/types";

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

export interface CreateEntityInput {
  type: "person" | "company";
  name: string;
  tier?: string;
  region?: string;
  seed_urls?: string[];
  notifications?: { email: boolean; webhook: boolean };
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
