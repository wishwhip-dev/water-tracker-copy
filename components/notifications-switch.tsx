"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  askForNotifications,
  NOTIFICATION_MESSAGES,
  useNotificationState,
  type NotificationState,
} from "@/lib/browser-notifications";

/**
 * "Turn on notifications", with every state in words. The button shows only while the browser can
 * still ask; once notifications are on, blocked for this site, or not available in this browser,
 * the state is a sentence instead ("Notifications are off for this site in your browser settings."),
 * never a button that does nothing. `onChange` hears the state after each answer.
 */
export function NotificationsSwitch({
  label = "Turn on notifications",
  onChange,
  className,
}: {
  label?: string;
  onChange?: (state: NotificationState) => void;
  className?: string;
}) {
  const state = useNotificationState();
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);

  async function turnOn() {
    setAsking(true);
    const result = await askForNotifications();
    setAsking(false);
    setNote(result.state === "default" ? result.message : "");
    onChange?.(result.state);
  }

  // The server and the first render do not know the permission: hold the line's place.
  if (state === null) return <p className={cn("min-h-9 text-sm text-muted-foreground", className)} aria-hidden="true" />;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      {state === "default" ? (
        <Button type="button" variant="outline" onClick={() => void turnOn()} disabled={asking}>
          {label}
        </Button>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          {NOTIFICATION_MESSAGES[state]}
        </p>
      )}
      {note && state === "default" && (
        <p role="status" className="text-sm text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  );
}
