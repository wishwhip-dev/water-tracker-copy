/**
 * This app's queries: glasses logged per day, and the daily goal.
 *
 * Components call these, never Dexie directly. Every write is awaited by its caller and its
 * failure shown — an unawaited or swallowed write is a glass the visitor never sees again.
 */
import { database, newId, type Glass } from "@/lib/db";
import { dayKey } from "@/lib/days";

const glasses = async () => (await database.ready()).glasses;
const settings = async () => (await database.ready()).settings;

/** The daily goal in glasses per day, falling back to the default when the row is somehow missing. */
export async function getGoal(): Promise<number> {
  const row = await (await settings()).get("goal");
  return row?.value ?? 8;
}

/** Save the daily goal. Callers validate; this stores what a real number passes. */
export async function setGoal(value: number): Promise<void> {
  await (await settings()).put({ id: "goal", value });
}

/** Log one glass on the given local day. */
export async function logGlass(day: string): Promise<void> {
  const glass: Glass = { id: newId(), day, at: Date.now() };
  await (await glasses()).add(glass);
}

/**
 * Take back the most recent glass logged on `day`. Returns whether there was one, so the caller
 * can stay silent when today's total is already zero.
 */
export async function removeGlass(day: string): Promise<boolean> {
  const table = await glasses();
  const todays = await table.where("day").equals(day).toArray();
  if (!todays.length) return false;
  const latest = todays.reduce((best, glass) => (glass.at > best.at ? glass : best));
  await table.delete(latest.id);
  return true;
}

/** How many glasses were logged on each of `days`, as a map keyed by day. */
export async function countByDay(days: readonly string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>(days.map((day) => [day, 0]));
  const first = days.length ? days[0] : dayKey(new Date(0));
  const rows = await (await glasses()).where("day").aboveOrEqual(first).toArray();
  for (const glass of rows) counts.set(glass.day, (counts.get(glass.day) ?? 0) + 1);
  return counts;
}
