"use client";

import { useSyncExternalStore } from "react";

/**
 * Browser notifications: the pop-ups the system shows, even while the visitor is in another tab. A
 * toast (`toast()` from sonner) is for the page itself; this is for a reminder or an alert.
 *
 * The permission is read before anything is asked. Once a visitor has blocked notifications for
 * this site, the browser never asks again: `Notification.requestPermission()` answers "denied" at
 * once and shows nothing, so a "Turn on notifications" button that only calls it does nothing at
 * all. Read the state first (`notificationState`, `useNotificationState`) and show a blocked state
 * as its sentence, never as a button. `NotificationsSwitch` in `@/components/notifications-switch`
 * does all of it.
 *
 * Notifications show only while the app is open in a tab or on the home screen: there is no push
 * from a server here. On an iPhone or iPad they exist only for an app added to the home screen.
 *
 * Client-only, hence the directive: call these from event handlers and effects, not during render.
 */

/** `unsupported`: this browser has no notifications here (an iPhone tab, an old browser, a server render). */
export type NotificationState = "granted" | "denied" | "default" | "unsupported";

/** Each state as a sentence for the screen. */
export const NOTIFICATION_MESSAGES: Record<NotificationState, string> = {
  granted: "Notifications are on.",
  denied: "Notifications are off for this site in your browser settings.",
  default: "Notifications are off.",
  unsupported: "This browser can't show notifications here.",
};

/** The permission as it stands. Never throws, never asks. */
export function notificationState(): NotificationState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  const permission = window.Notification.permission;
  return permission === "granted" || permission === "denied" ? permission : "default";
}

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * Calls `onChange` whenever the permission may have changed: after `askForNotifications`, when the
 * browser reports a change (the visitor allowed or blocked it in the site settings), and when the
 * tab comes back into view. Returns the unsubscribe.
 */
export function subscribeNotificationState(onChange: () => void): () => void {
  listeners.add(onChange);
  const onVisible = () => {
    if (document.visibilityState === "visible") onChange();
  };
  document.addEventListener("visibilitychange", onVisible);
  let status: PermissionStatus | null = null;
  let stopped = false;
  navigator.permissions?.query({ name: "notifications" as PermissionName })
    .then((found) => {
      if (stopped) return;
      status = found;
      status.addEventListener("change", onChange);
    })
    .catch(() => undefined);
  return () => {
    stopped = true;
    listeners.delete(onChange);
    document.removeEventListener("visibilitychange", onVisible);
    status?.removeEventListener("change", onChange);
  };
}

/**
 * The permission, kept current; null on the server and in the first render, so the page renders
 * the same there as on the server. Render a placeholder (or nothing) for null.
 */
export function useNotificationState(): NotificationState | null {
  return useSyncExternalStore(subscribeNotificationState, notificationState, () => null);
}

/**
 * Ask for notifications. Call it from a click, never on load. Never throws, and asks only when the
 * browser still can: a blocked or unsupported state comes back as it is, with its sentence.
 */
export async function askForNotifications(): Promise<{ state: NotificationState; message: string }> {
  const before = notificationState();
  if (before !== "default") return { state: before, message: NOTIFICATION_MESSAGES[before] };
  try {
    await window.Notification.requestPermission();
  } catch {
    // An old browser's callback-only form, or a refusal to ask: the state read below says which.
  }
  emit();
  const state = notificationState();
  // Closed without an answer: nothing is blocked, so the button stays.
  return { state, message: state === "default" ? "Notifications stayed off." : NOTIFICATION_MESSAGES[state] };
}

/**
 * Show a notification now, when the permission allows it. Returns whether one was shown. Goes
 * through the service worker where there is one, because Chrome on Android shows notifications only
 * that way (`new Notification` throws there).
 */
export async function showNotification(title: string, options: NotificationOptions = {}): Promise<boolean> {
  if (notificationState() !== "granted") return false;
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      return true;
    }
    new window.Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
