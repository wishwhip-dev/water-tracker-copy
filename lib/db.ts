/**
 * This application's database.
 *
 * The reusable half of the setup is in `lib/storage/` and is not edited. This file is the half
 * that describes the product: which tables exist, what is indexed, how the schema has changed over
 * time, and what a first visit starts with.
 */
import { defineDatabase } from "@/lib/storage/database";

/** One logged glass of water. `day` is the local calendar day it was drunk on ("2026-11-04"). */
export type Glass = {
  id: string;
  day: string;
  /** Epoch millis, when the glass was logged. Indexed, because "remove a glass" takes the latest. */
  at: number;
};

/** A single-row-per-key settings table. Today only the daily goal lives here. */
export type Setting = {
  id: string;
  /** Daily goal, in glasses per day. */
  value: number;
};

/** Ids are generated here so the data layer never depends on an auto-increment round trip. */
export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The default daily goal, written once on a first visit. */
export const DEFAULT_GOAL = 8;

export const database = defineDatabase<{ glasses: Glass; settings: Setting }>({
  // Part of the origin's storage identity. Renaming it does not migrate anything — it points the
  // application at a different, empty database and abandons the old one in place. That is exactly
  // what you want on a first build, and never what you want afterwards.
  name: "water-tracker",
  versions: [
    // Only the primary key and the properties queried on. `at` is stored and indexed because
    // removing a glass takes today's most recent one.
    { version: 1, stores: { glasses: "id, day, at", settings: "id" } },
  ],
  // Written once, inside `ready()`, in one transaction with its own marker. Do not hand-roll this:
  // no `meta` table, no flag, no promise to dedupe a double mount — see `docs/storage.md`.
  seed: {
    tables: ["settings"],
    run: async (db) => { await db.settings.put({ id: "goal", value: DEFAULT_GOAL }); },
  },
});
