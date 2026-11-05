"use client";

import { useEffect } from "react";

import { InstallCard } from "@/components/install-card";
import { SaveAsApp } from "@/components/save-as-app";
import { isStandalone, keepStorage, warmList } from "@/lib/home-screen";

// Keeps an offline copy of this app (public/sw.js), so after one visit it opens without a
// connection, shows the one-time "put it on your home screen" card on phones, and the lasting
// "Save as app" control in the bottom-right corner wherever this browser can install the app.
// Mounted once in app/providers.tsx. Do not edit, move or remove it; see docs/home-screen.md.

function registerOfflineCopy(): void {
  // Built apps only: in development every save changes the files the copy would keep.
  if (process.env.NODE_ENV !== "production") return;
  // Never on localhost: every project run there shares the one address and would inherit this copy.
  if (location.hostname === "localhost" || location.hostname.endsWith(".localhost")) return;
  let container: ServiceWorkerContainer | undefined;
  try {
    if (window.self !== window.top) return;
    container = navigator.serviceWorker; // a sandboxed frame throws on this read
  } catch {
    return;
  }
  if (!container) return;
  const worker = container;
  // Read by its full name so Next writes it into the bundle; set only for an app that sends notices.
  const push = process.env.NEXT_PUBLIC_WISHWHIP_PUSH_URL ? "?push=1" : "";
  worker
    .register(`/sw.js${push}`, { scope: "/", updateViaCache: "none" })
    .then(() => worker.ready)
    .then((registration) => {
      // What loaded before the copy took over the page, so it is kept as well.
      registration.active?.postMessage({ type: "warm", urls: warmList(performance.getEntriesByType("resource"), location.origin) });
    })
    .then(() => keepStorage(navigator, isStandalone(window)))
    .catch(() => {});
}

export function HomeScreen() {
  useEffect(() => {
    registerOfflineCopy();
  }, []);
  return (
    <>
      <InstallCard />
      <SaveAsApp />
    </>
  );
}
