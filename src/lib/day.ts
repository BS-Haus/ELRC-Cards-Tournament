// Calendar-day helpers in London time, for the rating model's day-to-day drift (rating.ts).
// Copied from the ranked app (spike-east, src/lib/day.ts): an explicit zone, never the host's, so
// the server (UTC) and a phone in London bucket a late game on the same day.
export const LEAGUE_TZ = "Europe/London";
export const DAY_MS = 86_400_000;

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: LEAGUE_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** The calendar day an epoch falls on in London: "YYYY-MM-DD". */
export function dayKey(t: number): string {
  return fmt.format(new Date(t));
}

/** A day key as a whole day number, so stepping day to day can't be knocked off by DST. */
export function dayNum(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}
