"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Settings } from "@/app/types";

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? fallback);
  return res.json();
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<Settings> => {
      const json = await jsonOrThrow<{ settings: Settings }>(await fetch("/api/settings"), "Failed to load settings");
      return json.settings;
    },
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Settings>): Promise<Settings> => {
      const json = await jsonOrThrow<{ settings: Settings }>(
        await fetch("/api/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        }),
        "Failed to save settings",
      );
      return json.settings;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}
