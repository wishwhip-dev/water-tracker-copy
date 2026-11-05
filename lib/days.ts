/**
 * Local calendar days: the key a glass is logged under, and the labels a day is shown with.
 *
 * Pure and browser-free, so the data layer can use it. A day's key is its local date,
 * "2026-11-04" — counted by the calendar, never by dividing milliseconds, so a midnight or a
 * daylight-saving shift cannot skip or repeat a day.
 */

const pad = (value: number) => String(value).padStart(2, "0");

/** The local calendar day `date` falls on, as "YYYY-MM-DD". */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The local calendar day `count` days before (or after, when negative) `date`. */
export function dayShift(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - count);
}

/** The local day a "YYYY-MM-DD" key stands for — not midnight UTC. */
export function dayFromKey(key: string): Date {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!parts) return new Date(Number.NaN);
  return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
}

/** The last `count` day keys ending at `end`, oldest first. */
export function lastDays(count: number, end: Date): string[] {
  const keys: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) keys.push(dayKey(dayShift(end, index)));
  return keys;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });

/** A day key as the page shows it: "Tue 4 Nov" in the visitor's locale. */
export function formatDay(key: string): string {
  const date = dayFromKey(key);
  return Number.isNaN(date.getTime()) ? key : dateFormat.format(date);
}

/** A day key for a chart's x-axis, short so fourteen fit: "4 Nov". */
export function formatDayShort(key: string): string {
  const date = dayFromKey(key);
  return Number.isNaN(date.getTime()) ? key : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(date);
}
