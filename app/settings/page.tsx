import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { GoalLoader, TransferCard } from "@/components/goal-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Settings" };

export default function Settings() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-bottom-bar pt-8 sm:px-6">
      <header className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/">
            <ArrowLeft aria-hidden /> Back to today
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">How much water a good day holds.</p>
      </header>
      <div className="space-y-4">
        <Card>
          <CardHeader className="gap-1">
            <CardTitle className="text-base">Daily goal</CardTitle>
            <CardDescription>Glasses of water to aim for each day.</CardDescription>
          </CardHeader>
          <CardContent>
            <GoalLoader />
          </CardContent>
        </Card>
        <TransferCard />
      </div>
    </main>
  );
}