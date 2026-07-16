"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { IcpProfile } from "@/app/types";

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? fallback);
  return res.json();
}

export function useIcp() {
  return useQuery({
    queryKey: ["icp"],
    queryFn: async (): Promise<IcpProfile | null> => {
      const json = await jsonOrThrow<{ icp: IcpProfile | null }>(await fetch("/api/icp"), "Failed to load ICP");
      return json.icp;
    },
  });
}

/** Save the ICP; the server re-scores open opportunities + candidates, so we
 * invalidate those queries (and monitoring, whose account hotness derives from
 * opportunities) once it returns. */
export function useSaveIcp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      icp: IcpProfile,
    ): Promise<{ icp: IcpProfile; rescored: { opportunities: number; candidates: number } }> => {
      return jsonOrThrow(
        await fetch("/api/icp", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(icp),
        }),
        "Failed to save ICP",
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["icp"] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["opportunity"] });
      qc.invalidateQueries({ queryKey: ["lead-candidates"] });
      qc.invalidateQueries({ queryKey: ["monitoring"] });
    },
  });
}

export const EMPTY_ICP: IcpProfile = {
  name: "Default ICP",
  offering: "",
  verticals: [],
  buyer_roles: [],
  company_sizes: [],
  regions: [],
  keywords: [],
  technologies: [],
  pain_themes: [],
};

/** True when the ICP actually constrains ranking (mirrors pipeline/icp.ts). */
export function icpIsMeaningful(icp: IcpProfile | null | undefined): boolean {
  if (!icp) return false;
  return Boolean(
    icp.offering?.trim() ||
      icp.verticals.length ||
      icp.buyer_roles.length ||
      icp.keywords.length ||
      icp.technologies.length ||
      icp.pain_themes.length,
  );
}
