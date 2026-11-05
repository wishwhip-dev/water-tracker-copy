"use client";

/**
 * Today's local day key, and it turns over by itself at midnight.
 *
 * `useSyncExternalStore` because a value only the browser knows must not be read during render:
 * the server snapshot is a fixed placeholder, the client snapshot is today, and a subscription
 * timer notifies the store just after local midnight so an app left open overnight rolls over
 * without a reload. The components treat the placeholder as "not yet today" and show a skeleton.
 */
import { useSyncExternalStore } from "react";
import { dayKey } from "@/lib/days";

/** What the server and the first hydration render see, before the browser says what day it is. */
export const SERVER_DAY = "2000-01-01";

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

function schedule() {
  if (timer) clearTimeout(timer);
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  timer = setTimeout(() => {
    timer = undefined;
    schedule();
    for (const listener of listeners) listener();
  }, nextMidnight.getTime() - now.getTime());
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  schedule();
  return () => {
    listeners.delete(onStoreChange);
    if (!listeners.size && timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
}

export function useToday(): string {
  return useSyncExternalStore(subscribe, () => dayKey(new Date()), () => SERVER_DAY);
}