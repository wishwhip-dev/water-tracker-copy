"use client";

import { useEffect, useSyncExternalStore } from "react";

import { identity } from "@/app/identity";
import { Button } from "@/components/ui/button";
import {
  cardFor, type CardContent, installPrompt, isStandalone, markOffered, platformOf, promptInstall, shouldOffer, wasOffered, worksOffline,
} from "@/lib/home-screen";
import manifest from "@/template.capabilities.json";

// The one-time "put it on your home screen" card, on phones only: the Share-menu steps in Safari on
// an iPhone or iPad, the browser's own install dialog on Android. Shown once per browser, never
// from the home screen, never in a frame. Rendered by <HomeScreen />; do not edit, move or restyle
// it, and add no install prompt of your own (docs/home-screen.md).

/** Whether this app works without a connection: a Local app only, from the capabilities it was built with. */
export const WORKS_OFFLINE = worksOffline((manifest as { capabilities?: unknown }).capabilities);

/** On an iPhone the card waits a moment, so the page is seen first. */
const IOS_DELAY_MS = 4000;

let card: CardContent | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function inFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function pointer(kind: "coarse" | "fine"): boolean {
  try {
    return window.matchMedia(`(pointer: ${kind})`).matches;
  } catch {
    return false;
  }
}

/** The card for this visit, or null when it has nothing true to say here. */
function cardForThisVisit(canPrompt: boolean): CardContent | null {
  const nav = navigator as Navigator & { standalone?: boolean };
  const platform = platformOf(nav.userAgent, nav.maxTouchPoints ?? 0, pointer("fine"));
  const offer = shouldOffer({
    platform,
    coarsePointer: pointer("coarse"),
    standalone: isStandalone(window),
    framed: inFrame(),
    automated: nav.webdriver === true,
    offered: wasOffered(browserStorage()),
    canPrompt,
  });
  return offer ? cardFor(platform, canPrompt, identity.name, WORKS_OFFLINE) : null;
}

function show(content: CardContent | null): void {
  if (!content || card) return;
  card = content;
  // Once per browser: remembered as soon as it is shown, whatever the person does with it.
  markOffered(browserStorage());
  emit();
}

function close(): void {
  card = null;
  emit();
}

if (typeof window !== "undefined") {
  // The browser's install prompt is held in lib/home-screen.ts from its first import, for this card
  // and the "Save as app" control alike. The card offers it once, when the event arrives.
  installPrompt.subscribe(() => {
    if (installPrompt.installed()) {
      markOffered(browserStorage());
      close();
    } else if (installPrompt.held()) {
      show(cardForThisVisit(true));
    }
  });
  if (installPrompt.held()) show(cardForThisVisit(true));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function install(): Promise<void> {
  close();
  // The dialog could not open, or was turned down: the card is gone either way.
  await promptInstall(installPrompt);
}

export function ShareIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="ml-1 inline size-4 align-text-bottom" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />
    </svg>
  );
}

export function InstallCard() {
  const content = useSyncExternalStore(subscribe, () => card, () => null);

  useEffect(() => {
    const timer = window.setTimeout(() => show(cardForThisVisit(false)), IOS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!content) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-safe">
      <div role="region" aria-label={content.heading} className="pointer-events-auto mb-4 flex w-full max-w-md flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm text-card-foreground shadow-lg">
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold">{content.heading}</p>
          <p className="text-muted-foreground">{content.lead}</p>
        </div>
        {content.kind === "steps" ? (
          <>
            <ol className="flex list-decimal flex-col gap-1 pl-5">
              {content.steps.map((step) => (
                <li key={step.text}>
                  {step.text}
                  {step.shareIcon ? <ShareIcon /> : null}
                </li>
              ))}
            </ol>
            <p className="text-muted-foreground">{content.note}</p>
            <div className="flex justify-end">
              <Button type="button" className="min-h-11" onClick={close}>{content.dismiss}</Button>
            </div>
          </>
        ) : (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" className="min-h-11" onClick={close}>{content.dismiss}</Button>
            <Button type="button" className="min-h-11" onClick={() => void install()}>{content.install}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
