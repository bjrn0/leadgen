/**
 * Date display for the dashboard: date only by default, optionally with the
 * hour in UTC — never minute-level timestamps (they add noise, not meaning).
 */
export function formatDateUTC(iso: string | null | undefined, opts: { withHour?: boolean } = {}): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const date = d.toISOString().slice(0, 10);
  if (!opts.withHour) return date;
  const hour = String(d.getUTCHours()).padStart(2, "0");
  return `${date} ${hour}:00 UTC`;
}
