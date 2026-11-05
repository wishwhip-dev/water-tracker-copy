import Link from "next/link";
import { Settings } from "lucide-react";

import { WaterHome } from "@/components/water-home";
import { Button } from "@/components/ui/button";
import { identity } from "@/app/identity";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-bottom-bar pt-8 sm:px-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{identity.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tap a glass in, watch the day fill up.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings">
            <Settings aria-hidden /> Settings
          </Link>
        </Button>
      </header>
      <WaterHome />
    </main>
  );
}