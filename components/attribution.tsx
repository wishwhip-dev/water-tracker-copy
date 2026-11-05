"use client";

import { useSyncExternalStore } from "react";

// The line every WishWhip app ends with: "Made with WishWhip · Report". The report link names this
// app, so a visitor who finds something wrong with it can tell WishWhip. Mounted once in
// app/layout.tsx, under the page. Do not edit, move, restyle, hide or remove it; see
// docs/attribution.md.

// Read by its full name so Next writes the value into the browser bundle at build time. WishWhip
// sets it on the app's deployment; without it (a local run, a copy of the code) nothing renders.
const WISHWHIP_URL = (process.env.NEXT_PUBLIC_WISHWHIP_URL ?? "").trim().replace(/\/+$/, "");
// Also set by WishWhip at deploy, from the owner's plan: "hidden" leaves only the Report link.
const BADGE = process.env.NEXT_PUBLIC_WISHWHIP_BADGE;
// This app's About page on WishWhip, set at deploy once the app has one; without it "Made with
// WishWhip" links to WishWhip itself.
const ABOUT_URL = (process.env.NEXT_PUBLIC_WISHWHIP_ABOUT_URL ?? "").trim();
// The About link's accessible name: APP_FOOTER.aboutLabel in WishWhip's lib/brand/copy/public.ts.
const ABOUT_LABEL = "About this app, made with WishWhip";

const LINK = "inline-flex min-h-9 min-w-8 items-center justify-center rounded px-2 underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2";

const unsubscribe = () => {};
const subscribe = () => unsubscribe;
const browserHost = () => location.host;
const serverHost = () => "";

export function Attribution() {
  // The server render has no address; the browser's adds it, so the report says which app it is.
  const host = useSyncExternalStore(subscribe, browserHost, serverHost);
  if (!/^https?:\/\//.test(WISHWHIP_URL)) return null;
  const report = host ? `${WISHWHIP_URL}/report?app=${encodeURIComponent(host)}` : `${WISHWHIP_URL}/report`;
  const about = /^https?:\/\//.test(ABOUT_URL);
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-1 py-2 text-xs text-muted-foreground" data-wishwhip-attribution="">
      {BADGE === "hidden" ? null : (
        <>
          <a href={about ? ABOUT_URL : WISHWHIP_URL} target="_blank" rel="noopener" className={LINK} aria-label={about ? ABOUT_LABEL : undefined}>Made with WishWhip</a>
          <span aria-hidden="true">·</span>
        </>
      )}
      <a href={report} target="_blank" rel="noopener" className={LINK} aria-label="Report this app to WishWhip">Report</a>
    </footer>
  );
}
