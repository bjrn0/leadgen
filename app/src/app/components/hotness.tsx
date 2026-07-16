"use client";

/**
 * Fit rank — the user-facing ranking that replaces the arbitrary 0–100 number.
 * A 1–5 segmented strength meter (filled = tier) plus a label, driven primarily
 * by ICP fit (see pipeline/icp.ts). Neutral and professional — no emoji, no
 * icons. The raw breakdown (ICP fit N/100 · signal M/100) lives only in the
 * hover tooltip, so the number stays available without cluttering the face.
 */

const LABELS_ICP: Record<number, string> = {
  5: "Strong ICP match",
  4: "Good fit",
  3: "Medium fit",
  2: "Weak fit",
  1: "Low fit",
};
const LABELS_SIGNAL: Record<number, string> = {
  5: "Very high signal",
  4: "High signal",
  3: "Medium signal",
  2: "Low signal",
  1: "Faint signal",
};

/** Tone by tier — green for strong fit, amber for the middle, slate for weak. */
function tone(tier: number): { seg: string; text: string } {
  if (tier >= 4) return { seg: "bg-emerald-500", text: "text-emerald-600" };
  if (tier === 3) return { seg: "bg-amber-500", text: "text-amber-600" };
  return { seg: "bg-slate-400", text: "text-muted-foreground" };
}

export function hotnessLabel(tier: number | null, hasIcp: boolean): string {
  if (!tier) return "Unranked";
  return (hasIcp ? LABELS_ICP : LABELS_SIGNAL)[tier] ?? "Unknown";
}

export function Hotness({
  tier,
  icpFit,
  signalScore,
  size = "md",
}: {
  tier: number | null;
  icpFit?: number | null;
  signalScore?: number | null;
  size?: "sm" | "md";
}) {
  const hasIcp = icpFit != null;
  const label = hotnessLabel(tier, hasIcp);
  const active = tier ?? 0;
  const { seg, text } = tone(active || 1);
  const segW = size === "sm" ? "w-3.5" : "w-4";
  const breakdown =
    icpFit != null
      ? `ICP fit ${icpFit}/100 · signal ${signalScore ?? 0}/100`
      : signalScore != null
        ? `signal ${signalScore}/100 · set an ICP to rank by fit`
        : "not yet ranked";

  return (
    <span className="inline-flex items-center gap-2" title={breakdown} data-hotness={active} aria-label={label}>
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => {
          const on = i < active;
          return (
            <span
              key={i}
              data-seg-active={on ? "true" : "false"}
              className={`h-1.5 ${segW} rounded-full ${on ? seg : "bg-muted-foreground/20"}`}
            />
          );
        })}
      </span>
      <span className={`text-xs font-medium ${text}`}>{label}</span>
    </span>
  );
}
