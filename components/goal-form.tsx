"use client";

/**
 * The daily-goal form, and the card that carries the data in and out of this browser.
 *
 * The form is keyed on the saved goal by its parent, so an old value never leaks into it; an
 * invalid entry is rejected with a message and the previous goal is kept, because nothing is
 * written until a real number passes.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { database } from "@/lib/db";
import { getGoal, setGoal } from "@/lib/data/water";
import { useDatabaseTransfer, useStoredQuery } from "@/lib/storage/react";

/** The highest goal the form accepts: over fifty glasses a day is not a goal anyone is keeping. */
export const MAX_GOAL = 50;

export function GoalForm({ initial }: { initial: number }) {
  const [value, setValue] = useState(String(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = value.trim();
    if (!text) {
      setError("Enter a number of glasses per day.");
      return;
    }
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      setError("Whole glasses only — enter a number like 8.");
      return;
    }
    if (parsed < 1) {
      setError("The goal must be at least 1 glass a day.");
      return;
    }
    if (parsed > MAX_GOAL) {
      setError(`Over ${MAX_GOAL} glasses a day is too much to be useful — pick a smaller goal.`);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await setGoal(parsed);
      toast.success("Goal saved", { description: `${parsed} glasses a day.` });
    } catch (cause) {
      // The write failed: say so and keep the form as it was. The saved goal is untouched.
      toast.error("Could not save the goal", {
        description: cause instanceof Error ? cause.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="daily-goal">Daily goal (glasses per day)</Label>
        <Input
          id="daily-goal"
          name="daily-goal"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_GOAL}
          step={1}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          aria-describedby={error ? "daily-goal-error" : undefined}
          aria-invalid={error ? true : undefined}
        />
        <p className="text-xs text-muted-foreground">Between 1 and {MAX_GOAL} glasses.</p>
      </div>
      {error && (
        <p id="daily-goal-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={saving}>
        Save goal
      </Button>
    </form>
  );
}

/** The goal from the database, loaded in the browser. The form is keyed on the saved goal, so a
 * stale value never leaks in while the real one loads. */
export function GoalLoader() {
  const { data, isLoading } = useStoredQuery(database, getGoal);
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  return <GoalForm key={data} initial={data ?? 8} />;
}

/**
 * Export to a file and back: the browser's database is the only copy, and preview and the
 * published site are separate origins, so a file is the way history moves.
 */
export function TransferCard() {
  const { state, exportToFile, importFromFile } = useDatabaseTransfer(database);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">Your data</CardTitle>
        <CardDescription>
          Everything lives in this browser. Export it to a file to carry it, or bring one back here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void exportToFile()}>
            Export data to a file
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            Import data from a file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Choose a data file to import"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFromFile(file);
              event.target.value = "";
            }}
          />
        </div>
        {state.kind === "working" && <p className="text-sm text-muted-foreground">Working…</p>}
        {state.kind === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}
        {state.kind === "imported" && (
          <p className="text-sm text-muted-foreground">
            Imported {state.result.rows} rows into this browser.
          </p>
        )}
      </CardContent>
    </Card>
  );
}