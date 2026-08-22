/**
 * Date helpers.
 *
 * The journal is organised around *local* calendar days, not instants. An
 * entry written at 23:50 belongs to that day, and `toISOString()` would move
 * it to tomorrow for anyone east of UTC — so day arithmetic here is done on
 * `YYYY-MM-DD` strings and local components, never on UTC.
 */

/** Today, as a local `YYYY-MM-DD`. */
export function today(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parse `YYYY-MM-DD` into a local midnight Date. */
export function parseDay(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const ms = parseDay(to).getTime() - parseDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** 1 on the start date itself, counting up from there. */
export function dayNumber(startDate: string, on: string = today()): number {
  return daysBetween(startDate, on) + 1;
}

/** "16 August 2026" */
export function formatDay(date: string): string {
  return parseDay(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "Sun 16 Aug" — compact, for dense listings. */
export function formatDayShort(date: string): string {
  return parseDay(date).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function isValidDay(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = parseDay(date);
  return !Number.isNaN(parsed.getTime()) && today(parsed) === date;
}
