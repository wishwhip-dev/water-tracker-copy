"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { identity } from "@/app/identity";
import { ShareIcon, WORKS_OFFLINE } from "@/components/install-card";
import { Button } from "@/components/ui/button";
import {
  installPath, type InstallPath, installPrompt, isStandalone, platformOf, promptInstall, SAVE_AS_APP_LABEL, saveSheetFor,
} from "@/lib/home-screen";

// The lasting "Save as app" control, in the bottom-right corner on every page: the browser's own
// install dialog where it has one (Chrome and Edge on Android and on a computer), the browser-menu
// steps on Android when there is no dialog to show (before it, after it was turned down, in Firefox
// and in other apps' browsers), the Share-menu steps on an iPhone or iPad, the "Add to Dock" steps
// in Safari on a Mac. Nothing in Firefox on a computer, from the home screen, once installed, or
// inside a frame. Nothing in the check's headless Chrome either,
// whose probe presses "Save…" buttons: its user agent is the guard (`platformOf`), since it does not
// set `navigator.webdriver`; `webdriver` is checked as well, for other driven browsers. Rendered by
// <HomeScreen />; do not edit, move or restyle it, and add no install prompt of your own
// (docs/home-screen.md).

function pointerFine(): boolean {
  try {
    return window.matchMedia("(pointer: fine)").matches;
  } catch {
    return false;
  }
}

function inFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** How the control helps on this visit; read on the client only, after the page has mounted. */
function pathForThisVisit(): InstallPath {
  const nav = navigator as Navigator & { standalone?: boolean };
  return installPath(platformOf(nav.userAgent, nav.maxTouchPoints ?? 0, pointerFine()), {
    promptHeld: installPrompt.held() !== null,
    standalone: isStandalone(window),
    installed: installPrompt.installed(),
    framed: inFrame(),
    automated: nav.webdriver === true,
  });
}

export function SaveAsApp() {
  const path = useSyncExternalStore(installPrompt.subscribe, pathForThisVisit, () => "none" as const);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const dismiss = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  useEffect(() => {
    if (!open) return;
    dismiss.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      opener.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    opener.current?.focus();
  };

  if (path === "none") return null;
  const sheet = path === "prompt" ? null : saveSheetFor(platformOf(navigator.userAgent, navigator.maxTouchPoints ?? 0), path, identity.name, WORKS_OFFLINE);

  // No `aria-label`: the visible label is the name (label in name); the plan's app-named one was dropped, the page is the app.
  return (
    <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)_+_3rem)] right-[calc(env(safe-area-inset-right)_+_1rem)] z-40 flex max-w-[calc(100vw_-_2rem)] flex-col items-end gap-2 print:hidden">
      {open && sheet ? (
        <div role="dialog" aria-labelledby={headingId} className="pointer-events-auto flex w-80 max-w-full flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm text-card-foreground shadow-lg">
          <div className="flex flex-col gap-1">
            <p id={headingId} className="text-base font-semibold">{sheet.heading}</p>
            <p className="text-muted-foreground">{sheet.lead}</p>
          </div>
          <ol className="flex list-decimal flex-col gap-1 pl-5">
            {sheet.steps.map((step) => (
              <li key={step.text}>
                {step.text}
                {step.shareIcon ? <ShareIcon /> : null}
              </li>
            ))}
          </ol>
          {sheet.note ? <p className="text-muted-foreground">{sheet.note}</p> : null}
          <div className="flex justify-end">
            <Button ref={dismiss} type="button" variant="outline" className="min-h-11" onClick={close}>{sheet.dismiss}</Button>
          </div>
        </div>
      ) : null}
      <Button
        ref={opener}
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={sheet ? open : undefined}
        className="pointer-events-auto min-h-11 rounded-full px-4 text-muted-foreground sm:min-h-9"
        onClick={() => (sheet ? setOpen((was) => !was) : void promptInstall(installPrompt))}
      >
        {SAVE_AS_APP_LABEL}
      </Button>
    </div>
  );
}
