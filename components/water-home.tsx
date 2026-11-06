"use client";

/**
 * The water tracker's home: today's readout, the log and remove controls, and the last two weeks.
 *
 * Everything reads the browser's database through `useStoredQuery`, so a write anywhere updates
 * every card here without a reload. Dates come from `useToday`, never from render time — the
 * server renders a placeholder and the real day arrives with hydration.
 */
import { useMemo } from "react";
import { toast } from "sonner";
import { Droplets, Minus, Plus } from "lucide-react";

import { DailyChart } from "@/components/daily-chart";
import { DaysTable } from "@/components/days-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { database } from "@/lib/db";
import { countByDay, getGoal, logGlass, removeGlass } from "@/lib/data/water";
import { dayFromKey, lastDays } from "@/lib/days";
import { useStorageStatus, useStoredQuery } from "@/lib/storage/react";
import { SERVER_DAY, useToday } from "@/lib/use-today";

export function WaterHome() {
  const today = useToday();
  const ready = today !== SERVER_DAY;
  const status = useStorageStatus(database);

  // The 14 days ending today, oldest first. Recomputed when the day rolls over at midnight.
  const days = useMemo(() => (ready ? lastDays(14, dayFromKey(today)) : []), [ready, today]);

  const goalQuery = useStoredQuery(database, getGoal, []);
  const historyQuery = useStoredQuery(
    database,
    async () => {
      const counts = await countByDay(days);
      return days.map((day) => ({ day, glasses: counts.get(day) ?? 0 }));
    },
    [days],
  );

  const goal = goalQuery.data ?? 8;
  const rows = historyQuery.data;
  const todayCount = rows?.find((row) => row.day === today)?.glasses ?? 0;
  const loading = !ready || goalQuery.isLoading || historyQuery.isLoading || !rows;

  const handleLog = async () => {
    try {
      await logGlass(today);
      const next = todayCount + 1;
      const description = next > goal
        ? `${next} of ${goal} today — goal passed.`
        : next === goal
          ? `${next} of ${goal} today — goal met.`
          : `${next} of ${goal} today.`;
      toast.success("Glass logged", { description });
    } catch (error) {
      toast.error("Could not log the glass", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  };

  const handleRemove = async () => {
    // Nothing to take back when today is at zero: do nothing, say nothing.
    if (todayCount === 0) return;
    try {
      const removed = await removeGlass(today);
      if (removed) toast("Glass removed", { description: `${todayCount - 1} of ${goal} today.` });
    } catch (error) {
      toast.error("Could not remove the glass", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-16 w-56" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-4 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-11 flex-1" />
              <Skeleton className="h-11 flex-1" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-56 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const met = todayCount >= goal;
  const remaining = goal - todayCount;
  const progress = goal > 0 ? Math.min(100, (todayCount / goal) * 100) : 0;

  return (
    <div className="space-y-4">
      {status === "memory" && (
        <Alert>
          <AlertTitle>This browser will not keep your data</AlertTitle>
          <AlertDescription>
            Storage is blocked here, so today&apos;s glasses are only kept until the tab closes. Export your
            history from Settings to a file if you want to keep it.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Droplets className="size-4 text-primary" aria-hidden />
            Today
          </CardTitle>
          <p className="text-4xl font-semibold tracking-tight tabular-nums">
            {todayCount}
            <span className="text-2xl font-medium text-muted-foreground"> of {goal} glasses</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            role="progressbar"
            aria-label="Today's progress toward the daily goal"
            aria-valuemin={0}
            aria-valuemax={goal}
            aria-valuenow={todayCount}
            className="h-3 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {met
              ? todayCount === goal
                ? "Goal met. Well poured."
                : `Goal met — ${todayCount - goal} past it.`
              : remaining === 1
                ? "1 glass to go."
                : `${remaining} glasses to go.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" className="min-w-40 flex-1" onClick={handleLog} aria-label="Add a glass of water">
              <Plus aria-hidden /> Add a glass
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-w-40 flex-1"
              onClick={handleRemove}
              aria-label="Remove the most recent glass logged today"
            >
              <Minus aria-hidden /> Remove a glass
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Last 14 days</CardTitle>
          <CardDescription>Glasses logged each day, against the {goal}-glass goal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <DailyChart rows={rows} goal={goal} />
          <DaysTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}