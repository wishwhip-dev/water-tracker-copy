/**
 * The home-screen module's decisions, kept apart from React so they can be tested: which browser
 * this is, whether the app is already running from the home screen, whether to offer the one-time
 * card, how the lasting "Save as app" control installs here, and what both say. The browser's
 * install prompt is held here too, from the first import, for the card and the control to share.
 * `components/home-screen.tsx`, `components/install-card.tsx` and `components/save-as-app.tsx` use
 * these. Do not edit; see docs/home-screen.md.
 */

/**
 * Where this visit can be put on a home screen, or a Dock.
 *
 * - `ios-safari`: Safari on an iPhone or iPad, from the Share menu.
 * - `ios-other`: another iPhone or iPad browser (Chrome, Edge, Firefox and the like), from its own
 *   Share menu since iOS 16.4.
 * - `android`: an Android browser (Chrome, Samsung Internet, Edge, Firefox and the like), which
 *   installs from its own menu, and Chromium's can offer its install dialog once it has sent
 *   `beforeinstallprompt`.
 * - `android-in-app`: the browser built into another app on Android (Facebook, Instagram, the
 *   Google app, any WebView), which can install only once the page is opened in a browser.
 * - `chromium-desktop`: Chrome, Edge and the other Chromium browsers on a computer (a fine
 *   pointer, not Android), which send the same event.
 * - `mac-safari`: Safari on a Mac, from the File menu's "Add to Dock".
 * - `firefox`: Firefox on a computer, which cannot install a web app.
 * - `other`: everything else, including the browsers built into other apps.
 */
export type InstallPlatform = "ios-safari" | "ios-other" | "android" | "android-in-app" | "chromium-desktop" | "mac-safari" | "firefox" | "other";

/** An iPad on iPadOS 13 and later says "Macintosh"; its touch screen gives it away. */
function isIos(userAgent: string, maxTouchPoints: number): boolean {
  return /\b(?:iPhone|iPad|iPod)\b/.test(userAgent) || (/\bMacintosh\b/.test(userAgent) && maxTouchPoints > 1);
}

/** Other iPhone browsers, which put a page on the home screen from their own Share menu. */
const IOS_BROWSERS = /\b(?:CriOS|FxiOS|EdgiOS|OPiOS|OPT|DuckDuckGo|YaBrowser)\b/;

/** The browsers built into other apps, which cannot put a page on the home screen at all. */
const IN_APP = /\b(?:GSA|FBAN|FBAV|FB_IAB|Instagram|Line|LinkedInApp|Twitter|MicroMessenger|Snapchat|Pinterest|TikTok|musical_ly)\b/;

/** Chrome, Edge, Opera, Samsung Internet, Brave and the rest share Chromium's token. */
const CHROMIUM = /\b(?:Chrome|Chromium)\/\d/;

/**
 * `finePointer` is `(pointer: fine)`: a mouse or a trackpad, which tells a computer's Chromium from
 * a tablet's. Left out, no Chromium counts as a computer's.
 */
export function platformOf(userAgent: string, maxTouchPoints: number, finePointer = false): InstallPlatform {
  // The check's browser, which presses buttons labelled "Save…" and does not set `webdriver`.
  if (/\bHeadlessChrome\//.test(userAgent)) return "other";
  if (isIos(userAgent, maxTouchPoints)) {
    if (IN_APP.test(userAgent)) return "other";
    if (IOS_BROWSERS.test(userAgent)) return "ios-other";
    // An app's built-in browser usually drops the "Safari/" token as well.
    return /\bSafari\//.test(userAgent) ? "ios-safari" : "other";
  }
  if (/\bAndroid\b/.test(userAgent)) {
    // Android's in-app browsers ("; wv)" is a WebView) never send `beforeinstallprompt`; the page
    // has to be opened in a browser first.
    if (IN_APP.test(userAgent) || /; wv\)/.test(userAgent)) return "android-in-app";
    // Firefox for Android installs from its own menu too, without the event.
    return "android";
  }
  // Gecko on a computer: no web app install at all.
  if (/\bFirefox\//.test(userAgent) && /\bGecko\/\d/.test(userAgent)) return "firefox";
  if (CHROMIUM.test(userAgent)) return finePointer ? "chromium-desktop" : "other";
  // "Add to Dock" arrived in Safari 17 (macOS Sonoma). Safari proper ends with its token; DuckDuckGo
  // for Mac and the like add their own after it, and have no "Add to Dock".
  const safari = /\bMacintosh\b/.test(userAgent) ? userAgent.match(/\bVersion\/(\d+)[\d.]* Safari\/[\d.]+$/) : null;
  if (safari && Number(safari[1]) >= 17) return "mac-safari";
  return "other";
}

type DisplayWindow = {
  matchMedia?: (query: string) => { matches: boolean };
  /** Safari on iOS adds `standalone` to its navigator; no type of the DOM's declares it. */
  navigator?: unknown;
};

/** Whether the app is running from the home screen (or as an installed app on a computer). */
export function isStandalone(win: DisplayWindow): boolean {
  try {
    if ((win.navigator as { standalone?: unknown } | undefined)?.standalone === true) return true;
    return Boolean(win.matchMedia?.("(display-mode: standalone)").matches || win.matchMedia?.("(display-mode: fullscreen)").matches);
  } catch {
    return false;
  }
}

/** What the card needs to know about this visit. */
export type Visit = {
  platform: InstallPlatform;
  /** `(pointer: coarse)`: a finger, not a mouse. */
  coarsePointer: boolean;
  standalone: boolean;
  /** Inside another page's frame. */
  framed: boolean;
  /** `navigator.webdriver`: a browser driven by a program, never a person. */
  automated: boolean;
  /** The card was already shown in this browser. */
  offered: boolean;
  /** Android only: the browser sent `beforeinstallprompt` and it is being held. */
  canPrompt: boolean;
};

/** Whether this visit gets the card: once per browser, on a phone, when it can say something true. */
export function shouldOffer(visit: Visit): boolean {
  if (visit.offered || visit.standalone || visit.framed || visit.automated || !visit.coarsePointer) return false;
  if (visit.platform === "ios-safari") return true;
  if (visit.platform === "android") return visit.canPrompt;
  return false;
}

export type CardStep = { text: string; shareIcon?: true };

export type CardContent =
  | { kind: "steps"; heading: string; lead: string; steps: CardStep[]; note: string; dismiss: string }
  | { kind: "install"; heading: string; lead: string; install: string; dismiss: string };

/** The Share-menu steps, the card's and the control's. Safari is named only where it is Safari. */
function iosSteps(platform: "ios-safari" | "ios-other", name: string): CardStep[] {
  return [
    { text: platform === "ios-safari" ? "Tap the Share button in Safari's toolbar." : "Tap the Share button in your browser.", shareIcon: true },
    { text: "Scroll down and tap “Add to Home Screen”." },
    { text: `Tap “Add”, then open ${name} from your home screen.` },
  ];
}

/** What a Connected app asks its host for, which the offline copy never keeps (`public/sw.js` skips `/_wishwhip/`). */
const NEEDS_CONNECTION = ["connected", "data", "uploads", "live", "ai"] as const;

/**
 * Whether this app works without a connection, read from the `capabilities` of its
 * `template.capabilities.json`: only a Local app does. A Connected app (internet access, shared
 * data, files, live updates or AI) shows what its host answers, so its words never promise that.
 * Capabilities that cannot be read count as Connected: the line is left out rather than untrue.
 */
export function worksOffline(capabilities: unknown): boolean {
  if (!capabilities || typeof capabilities !== "object" || Array.isArray(capabilities)) return false;
  return !NEEDS_CONNECTION.some((name) => (capabilities as Record<string, unknown>)[name] === true);
}

/** The line under every heading: the "without a connection" promise only where it is true. */
function leadFor(offline: boolean): string {
  return offline ? "It opens full screen, like an app, and works without a connection." : "It opens full screen, like an app.";
}

/**
 * The card's words. The app's name is the only name in it. No button starts with "Add", "New" or
 * "Create", and none says delete, remove, clear, reset or the like: those words mean something to
 * the app's own controls, and the card must never be mistaken for one. `offline` is `worksOffline`.
 */
export function cardFor(platform: InstallPlatform, canPrompt: boolean, name: string, offline = true): CardContent | null {
  if (platform === "ios-safari") {
    return {
      kind: "steps",
      heading: `Put ${name} on your home screen`,
      lead: leadFor(offline),
      steps: iosSteps(platform, name),
      note: `What you save here in Safari stays in Safari, unless the app shares it on purpose, so start using ${name} from your home screen.`,
      dismiss: "Got it",
    };
  }
  if (platform === "android" && canPrompt) {
    return {
      kind: "install",
      heading: `Put ${name} on your home screen`,
      lead: offline ? "It gets its own icon, opens full screen and works without a connection." : "It gets its own icon and opens full screen.",
      install: "Install",
      dismiss: "Not now",
    };
  }
  return null;
}

// ——— The lasting "Save as app" control ————————————————————————————————————————————————————————

/**
 * How the control helps here: the browser's own install dialog (`prompt`), the Share-menu steps on
 * an iPhone or iPad (`ios-steps`), the browser-menu steps on Android (`android-steps`), the "Add to
 * Dock" steps in Safari on a Mac (`mac-steps`), or not at all (`none`). On Android the control is
 * always there: the dialog while the browser's `beforeinstallprompt` is held, the menu steps before
 * it arrives, once it was used and turned down, in Firefox and in other apps' browsers. Chromium on
 * a computer shows nothing until it has sent the event; Firefox on a computer and unknown browsers
 * never do. Nothing from the home screen or once installed, nothing inside another
 * page's frame, and nothing in the check's headless Chrome, whose probe presses a "Save…" button
 * when it submits a form: its user agent ("HeadlessChrome/") is the guard, in `platformOf`, since
 * it does not set `navigator.webdriver`. `automated` (`webdriver`) is extra, for other driven browsers.
 */
export type InstallPath = "prompt" | "ios-steps" | "android-steps" | "mac-steps" | "none";

export type InstallState = {
  /** The browser sent `beforeinstallprompt` and it is being held. */
  promptHeld: boolean;
  standalone: boolean;
  /** `appinstalled` fired, or the person accepted the dialog, in this page. */
  installed?: boolean;
  framed?: boolean;
  automated?: boolean;
};

export function installPath(platform: InstallPlatform, state: InstallState): InstallPath {
  if (state.standalone || state.installed || state.framed || state.automated) return "none";
  switch (platform) {
    case "android":
    case "android-in-app":
      return state.promptHeld ? "prompt" : "android-steps";
    case "chromium-desktop":
      return state.promptHeld ? "prompt" : "none";
    case "ios-safari":
    case "ios-other":
      return "ios-steps";
    case "mac-safari":
      return "mac-steps";
    default:
      return "none";
  }
}

/**
 * The control's label, visible and accessible both. Not "Add…", "New…" or "Create…": the check
 * presses those as the app's main action. It does start with "Save", which the check presses to
 * submit a form, so the check's browser never sees the control (`platformOf`).
 */
export const SAVE_AS_APP_LABEL = "Save as app";

export type SaveSheet = { heading: string; lead: string; steps: CardStep[]; note?: string; dismiss: string };

/** The browser-menu steps on Android; in another app's browser, opening the page in Chrome comes first. */
function androidSteps(platform: InstallPlatform): CardStep[] {
  return [
    ...(platform === "android-in-app" ? [{ text: "Open this page in Chrome first (menu → Open in browser)" }] : []),
    { text: "Open the browser menu (⋮)" },
    { text: "Tap Install app or Add to Home screen" },
    { text: "Tap Install or Add" },
  ];
}

/** The small sheet the control opens where no browser dialog can install. `offline` is `worksOffline`. */
export function saveSheetFor(platform: InstallPlatform, path: "ios-steps" | "android-steps" | "mac-steps", name: string, offline = true): SaveSheet {
  const lead = leadFor(offline);
  if (path === "android-steps") {
    return { heading: "Save it to your home screen", lead, steps: androidSteps(platform), dismiss: "Got it" };
  }
  if (path === "mac-steps") {
    return {
      heading: `Put ${name} in your Dock`,
      lead,
      steps: [{ text: "In Safari, open the File menu and choose “Add to Dock”." }, { text: `Then open ${name} from your Dock.` }],
      dismiss: "Got it",
    };
  }
  const safari = platform === "ios-safari";
  return {
    heading: `Put ${name} on your home screen`,
    lead,
    steps: iosSteps(safari ? "ios-safari" : "ios-other", name),
    note: safari
      ? `What you save here in Safari stays in Safari, unless the app shares it on purpose, so start using ${name} from your home screen.`
      : `What you save here stays in this browser, unless the app shares it on purpose, so start using ${name} from your home screen.`,
    dismiss: "Got it",
  };
}

// ——— The browser's install prompt, held for the card and the control ———————————————————————————

export type InstallChoice = { outcome?: string };
export type InstallPromptEvent = Event & { prompt: () => Promise<unknown>; userChoice?: Promise<InstallChoice> };

type PromptTarget = { addEventListener: (type: string, listener: (event: Event) => void) => void };

export type InstallPromptStore = {
  /** The latest `beforeinstallprompt`, while it can still be used. */
  held: () => InstallPromptEvent | null;
  /** `appinstalled` fired, or the dialog was accepted. */
  installed: () => boolean;
  /** Hands over the held event, once: a prompt can be shown only once. */
  take: () => InstallPromptEvent | null;
  markInstalled: () => void;
  subscribe: (listener: () => void) => () => void;
};

/**
 * Listens on `target` for `beforeinstallprompt`, always holds the browser's own banner back and
 * keeps the latest event, and for `appinstalled`. Android and Chrome send the event once the app can
 * be installed, often before the page has finished loading, so it is listened for at import.
 */
export function holdInstallPrompt(target: PromptTarget | undefined): InstallPromptStore {
  let held: InstallPromptEvent | null = null;
  let installed = false;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  const markInstalled = () => {
    held = null;
    installed = true;
    emit();
  };
  target?.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    held = event as InstallPromptEvent;
    emit();
  });
  target?.addEventListener("appinstalled", markInstalled);
  return {
    held: () => held,
    installed: () => installed,
    take: () => {
      const event = held;
      held = null;
      if (event) emit();
      return event;
    },
    markInstalled,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** This page's prompt, held from the first import of this file. */
export const installPrompt: InstallPromptStore = holdInstallPrompt(typeof window === "undefined" ? undefined : window);

/**
 * Shows the browser's install dialog from the held event, and counts the app installed when the
 * person accepts. Resolves whatever happens; false when there was nothing to show.
 */
export async function promptInstall(store: InstallPromptStore): Promise<boolean> {
  const event = store.take();
  if (!event) return false;
  try {
    const answer = (await event.prompt()) as InstallChoice | undefined;
    const choice = answer?.outcome ? answer : await event.userChoice;
    if (choice?.outcome === "accepted") store.markInstalled();
  } catch {
    // The dialog could not open; the browser may send the event again.
  }
  return true;
}

/** Where this browser remembers that the card was shown. Not the app's data: one flag, nothing else. */
export const OFFERED_KEY = "home-screen.offered";

type FlagStorage = Pick<Storage, "getItem" | "setItem">;

export function wasOffered(storage: FlagStorage | undefined): boolean {
  try {
    return storage?.getItem(OFFERED_KEY) === "1";
  } catch {
    // Storage that cannot be read: treat the card as shown rather than show it on every visit.
    return true;
  }
}

export function markOffered(storage: FlagStorage | undefined): void {
  try {
    storage?.setItem(OFFERED_KEY, "1");
  } catch {
    // Nothing to do: the card simply may show again.
  }
}

/**
 * The same-origin files the page has loaded so far that are worth keeping offline: its scripts,
 * styles and fonts under /_next/static/, its icons and its manifest. Handed to the offline copy
 * (`public/sw.js`) once it controls the page, so what loaded before it took over is kept too.
 */
export function warmList(entries: readonly { name: string }[], origin: string): string[] {
  const urls = new Set<string>();
  for (const entry of entries) {
    let url: URL;
    try {
      url = new URL(entry.name);
    } catch {
      continue;
    }
    if (url.origin !== origin) continue;
    const path = url.pathname + url.search;
    if (/^\/(?:_next\/static\/|icon\b|apple-icon\b|manifest\.webmanifest$)/.test(url.pathname)) urls.add(path);
    if (urls.size >= 200) break;
  }
  return [...urls];
}

type PersistNavigator = { userAgent?: string; storage?: { persist?: () => Promise<boolean>; persisted?: () => Promise<boolean> } };

/**
 * Asks once, from the home screen, that the browser keep this app's data when the device is low on
 * space. Chrome and Safari decide without asking the person; Firefox would show a prompt, so it is
 * never asked there. Resolves whatever happens.
 */
export async function keepStorage(nav: PersistNavigator, standalone: boolean): Promise<void> {
  if (!standalone || /\bFirefox\//.test(nav.userAgent ?? "")) return;
  try {
    if (!nav.storage?.persist || (await nav.storage.persisted?.())) return;
    await nav.storage.persist();
  } catch {
    // Not available: the data stays as it was.
  }
}
