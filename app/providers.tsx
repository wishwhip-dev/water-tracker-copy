"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { makeQueryClient } from "@/lib/query";
import { Toaster } from "sonner";
import { HomeScreen } from "@/components/home-screen";
import { VisitBeacon } from "@/components/visit-beacon";

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  const [queryClient] = useState(makeQueryClient);
  return <QueryClientProvider client={queryClient}><>{children}<Toaster richColors position="top-right" /><HomeScreen /><VisitBeacon /></></QueryClientProvider>;
}
