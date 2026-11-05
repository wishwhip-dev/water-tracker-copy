/**
 * Rows for a chart over time with every period in it, empty ones included.
 *
 * Also here: `recentPeriods` for a rolling window that leaves out the period still going, and
 * `niceAxis` for a y-axis with whole, even ticks and room for its labels.
 *
 * Data grouped by month (or week, or day) has no row for a month with nothing in it, and a chart
 * given those rows leaves the month out: the axis jumps from May to August and nobody can tell
 * June and July were empty. `fillPeriods` puts a row in for every period from `from` to `to`, so an
 * empty month is drawn as an empty (zero) bar in its place.
 *
 * Periods are keyed as text in the visitor's local time: "2026-09" for a month, "2026-09-14" for a
 * day, and a week by its Monday's day. Pure: no React, no browser. Its `from` and `to` are yours to
 * pass, never `new Date()` during render (the server's time differs: see AGENTS.md "Hydration").
 */

export type PeriodUnit = "day" | "week" | "month";

const pad = (value: number) => String(value).padStart(2, "0");

function toDate(value: Date | string | number): Date {
  if (value instanceof Date) return new Date(value.getTime());
  // A bare "2026-09" or "2026-09-14" is that local month or day, not midnight UTC.
  if (typeof value === "string") {
    const parts = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
    if (parts) return new Date(Number(parts[1]), Number(parts[2]) - 1, parts[3] ? Number(parts[3]) : 1);
  }
  return new Date(value);
}

/** The period `date` falls in, as its key. */
export function periodKey(date: Date | string | number, unit: PeriodUnit = "month"): string {
  const day = toDate(date);
  if (Number.isNaN(day.getTime())) return "";
  if (unit === "month") return `${day.getFullYear()}-${pad(day.getMonth() + 1)}`;
  if (unit === "week") day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** Every period's key from the one `from` falls in to the one `to` falls in, in order. At most 1,000. */
export function periodKeys(from: Date | string | number, to: Date | string | number, unit: PeriodUnit = "month"): string[] {
  const start = toDate(periodKey(from, unit));
  const end = periodKey(to, unit);
  if (Number.isNaN(start.getTime()) || !end) return [];
  const keys: string[] = [];
  for (let cursor = start; keys.length < 1000; ) {
    const key = periodKey(cursor, unit);
    if (key > end) break;
    keys.push(key);
    if (unit === "month") cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    else cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + (unit === "week" ? 7 : 1));
  }
  return keys;
}

/**
 * `rows` with one row for every period from `from` to `to`, in order. A row's period is read from
 * its `key` field (a key from `periodKey`); a period with no row gets `empty(key)`, which returns
 * the row an empty period draws as (its values 0). Rows outside the range are dropped.
 *
 *   const months = fillPeriods(totals, { key: "month", from: first, to: today, empty: (month) => ({ month, spend: 0 }) });
 */
export function fillPeriods<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  options: { key: keyof Row & string; from: Date | string | number; to: Date | string | number; unit?: PeriodUnit; empty: (key: string) => Row },
): Row[] {
  const unit = options.unit ?? "month";
  const byKey = new Map<string, Row>();
  for (const row of rows) byKey.set(String(row[options.key]), row);
  return periodKeys(options.from, options.to, unit).map((key) => byKey.get(key) ?? options.empty(key));
}

/** A period's key as an axis label in the visitor's language: "Sep" (or "Sep 2026" with `year`), "14 Sep" for a day or a week. */
export function periodLabel(key: string, unit: PeriodUnit = "month", options: { year?: boolean; locale?: string } = {}): string {
  const date = toDate(key);
  if (Number.isNaN(date.getTime())) return key;
  const format: Intl.DateTimeFormatOptions = unit === "month"
    ? { month: "short", ...(options.year ? { year: "numeric" } : {}) }
    : { day: "numeric", month: "short", ...(options.year ? { year: "numeric" } : {}) };
  return new Intl.DateTimeFormat(options.locale, format).format(date);
}

/** The key of the period just before the one `date` falls in: yesterday, last week, last month. */
export function lastCompletePeriod(date: Date | string | number, unit: PeriodUnit = "day"): string {
  const day = toDate(periodKey(date, unit));
  if (Number.isNaN(day.getTime())) return "";
  if (unit === "month") return periodKey(new Date(day.getFullYear(), day.getMonth() - 1, 1), unit);
  return periodKey(new Date(day.getFullYear(), day.getMonth(), day.getDate() - (unit === "week" ? 7 : 1)), unit);
}

/**
 * The keys of the last `count` periods, oldest first, for a rolling window ("last 7 nights") and
 * its average. The period `now` falls in is still going (tonight has no sleep logged until
 * morning, this month is half spent), so it is left out unless `includeCurrent` is set: an average
 * over a period that cannot have data yet is pulled down by an empty one. Average over these keys
 * only; a period with no row is a gap the caption names, not a hidden zero.
 *
 *   const nights = recentPeriods(7, { now, unit: "day" });          // yesterday and the 6 nights before it
 *   const rows = fillPeriods(log, { key: "night", from: nights[0], to: nights[6], unit: "day", empty: ... });
 */
export function recentPeriods(
  count: number,
  options: { now: Date | string | number; unit?: PeriodUnit; includeCurrent?: boolean },
): string[] {
  const unit = options.unit ?? "day";
  const last = options.includeCurrent ? periodKey(options.now, unit) : lastCompletePeriod(options.now, unit);
  const wanted = Math.min(1000, Math.max(0, Math.floor(count)));
  if (!last || !wanted) return [];
  const keys = [last];
  while (keys.length < wanted) keys.unshift(lastCompletePeriod(keys[0], unit));
  return keys;
}

/**
 * A y-axis for numbers from 0 to `max`: a round top, evenly spaced whole-number ticks (0, 2, 4, 6,
 * 8, 10 rather than 0, 3, 6, 10), and a `width` for the `YAxis` wide enough for its longest label,
 * so no label is clipped (a top "10" drawn as ".0"). `format` turns a tick into its label (the
 * same one the axis's `tickFormatter` uses); `count` is about how many steps to aim for.
 *
 *   const axis = niceAxis(Math.max(0, ...rows.map((row) => row.hours)));
 *   <YAxis domain={[0, axis.top]} ticks={axis.ticks} width={axis.width} allowDecimals={false} tickLine={false} axisLine={false} />
 */
export function niceAxis(
  max: number,
  options: { count?: number; format?: (value: number) => string } = {},
): { top: number; ticks: number[]; width: number } {
  const format = options.format ?? ((value: number) => String(value));
  const target = Math.max(1, Math.floor(options.count ?? 5));
  const highest = Number.isFinite(max) && max > 0 ? max : 0;
  const rough = Math.max(1, highest / target);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rough) ?? 10 * magnitude;
  const top = Math.max(step, Math.ceil(highest / step) * step);
  const ticks: number[] = [];
  for (let tick = 0; tick <= top && ticks.length <= 100; tick += step) ticks.push(tick);
  // About 8px a character at the chart's 12px labels, plus the gap to the plot; never under 40.
  const longest = Math.max(...ticks.map((tick) => format(tick).length));
  return { top, ticks, width: Math.max(40, longest * 8 + 16) };
}
