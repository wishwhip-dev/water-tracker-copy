/**
 * GENERATED FILE — do not edit here.
 *
 * Vendored from the supervisor repository's `packages/app-storage` at version 0.4.0.
 * A later copy of the package replaces this file, so an edit made here is lost.
 * Anything this product needs that the shared code does not do belongs in lib/db.ts, lib/data/,
 * or a new module of your own.
 */
/**
 * Copies: one live app, several separate sets of data in one browser.
 *
 * Since 0.4.0 an application can be opened as somebody's own copy. The link carries the copy's
 * settings in its fragment (`#c=<settings>`), the page reads them on first open, and from then on
 * that copy has its own database, its own `localStorage` keys and its own settings, beside the
 * original's and beside any other copy's. Nothing is built and nothing is sent anywhere: a fragment
 * never reaches a server, and everything below lives in the visitor's own browser.
 *
 * This file owns the fragment keys `k` (the copy id) and `c` (the settings), the list of copies
 * this browser knows, and the one decision every other part reads: which copy this page load is.
 * It treats the settings string as opaque apart from a size and shape check; the config package
 * (`lib/config/`) validates what is inside it.
 *
 * ## The copy id
 *
 * Ten Crockford base32 characters, derived from the settings the copy was first opened with. So
 * the same link opened twice on one device lands in the same copy rather than silently starting an
 * empty one, even in a browser that refuses to remember anything; and a person who receives a link
 * on another device gets a copy of their own there, because their data was never anywhere else.
 * The id is not a secret: it names a namespace, and no data travels in the address.
 *
 * ## Which copy a page load is
 *
 * Decided once, synchronously, on the first call, before the database opens; cached for the
 * page's life.
 *
 * | The address carries | This device | Result |
 * | --- | --- | --- |
 * | `k` known here | any `c` | that copy, with its stored settings (the bar is rewritten to them) |
 * | `k` unknown here | `c` or none | a new copy with id `k` and the link's settings |
 * | `c`, no `k` | a copy made from this `c` exists | that copy |
 * | `c`, no `k` | none | a new copy; the bar becomes `#k=…&c=…` |
 * | `c` unreadable or too long | | the original, marked `unreadableLink` |
 * | nothing | this tab had a copy open | that copy (a reload, a route opened without the fragment) |
 * | nothing | installed app last opened as a copy | that copy |
 * | nothing | otherwise | the original |
 *
 * Every access to browser storage is guarded: a browser that refuses still resolves from the
 * fragment alone, with no list of copies.
 */

/** A copy id: 10 Crockford base32 characters, lower case. Not a secret: a label for a namespace. */
export type CopyId = string;

export const COPY_ID_PATTERN = /^[0-9a-hjkmnp-tv-z]{10}$/;

/** The most characters a `c` value may have. A longer one is refused before anything decodes it. */
export const MAX_SETTINGS_CHARS = 2048;

/** How many copies the list remembers. The oldest is dropped from the list; its data stays. */
export const MAX_REMEMBERED_COPIES = 20;

export type CopyRecord = {
  id: CopyId;
  /** Epoch ms. */
  created: number;
  /** Epoch ms, updated on every open. */
  opened: number;
  /** 8 hex characters, FNV-1a of the `c` it was created from. */
  from?: string;
  /** The copy's title setting, for an "open your copy" message. */
  title?: string;
};

export type CopyResolution =
  | { kind: "original"; unreadableLink?: true }
  | {
    kind: "copy";
    id: CopyId;
    /** True only on the page load that created this copy on this device: the first open. */
    created: boolean;
    via: "link" | "tab" | "home-screen";
  };

const REGISTRY_KEY = "wishwhip.copies";
const SETTINGS_PREFIX = "wishwhip.copy.";
const STANDALONE_KEY = "wishwhip.standalone";
const TAB_KEY = "wishwhip.copy";
const CROCKFORD = "0123456789abcdefghjkmnpqrstvwxyz";

const ORIGINAL: CopyResolution = Object.freeze({ kind: "original" });

let resolved: CopyResolution | undefined;
/** The active copy's settings, kept here too so a browser that refuses storage still has them. */
let activeSettings: string | undefined;
const listeners = new Set<() => void>();

// ---------------------------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------------------------

function fnv1a(text: string, seed = 0x811c9dc5): number {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** 8 hex characters identifying a settings string. Recorded as a copy's `from`. */
export function settingsFingerprint(settings: string): string {
  return fnv1a(settings).toString(16).padStart(8, "0");
}

/**
 * The copy id a settings string opens as: stable, so the same link on the same device always
 * lands in the same copy. 50 bits from two independent 32-bit hashes.
 */
export function copyIdFor(settings: string): CopyId {
  const first = fnv1a(settings);
  const second = fnv1a(settings, 0x9747b28c);
  let id = "";
  for (let index = 0; index < 6; index += 1) id += CROCKFORD[(first >>> (index * 5)) & 31];
  for (let index = 0; index < 4; index += 1) id += CROCKFORD[(second >>> (index * 5)) & 31];
  return id;
}

/** The fragment keys this package owns, read from a hash. Values are raw, never decoded. */
export function readFragment(hash: string): { c?: string; k?: string; move?: string } {
  const result: { c?: string; k?: string; move?: string } = {};
  for (const part of hash.replace(/^#/, "").split("&")) {
    const equals = part.indexOf("=");
    if (equals <= 0) continue;
    const key = part.slice(0, equals);
    const value = part.slice(equals + 1);
    if ((key === "c" || key === "k" || key === "move") && result[key] === undefined) result[key] = value;
  }
  return result;
}

/** Every part of a hash that is not `c=` or `k=` (or `move=` too, when asked), in order. */
function otherParts(hash: string, dropMove = false): string[] {
  return hash.replace(/^#/, "").split("&").filter((part) => {
    if (part === "") return false;
    if (part.startsWith("c=") || part.startsWith("k=")) return false;
    return !(dropMove && part.startsWith("move="));
  });
}

function decodeBase64Url(value: string): string | undefined {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return undefined;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

/**
 * Whether a `c` value can be a settings string at all: within the size cap, and either URL-safe
 * base64 of a JSON object or a JSON object written plainly (percent-encoded or not). What the
 * object holds is the config package's business.
 */
export function isReadableSettings(settings: string): boolean {
  if (settings.length === 0 || settings.length > MAX_SETTINGS_CHARS) return false;
  let json: string | undefined;
  if (/^(\{|%7b)/i.test(settings)) {
    try {
      json = decodeURIComponent(settings);
    } catch {
      return false;
    }
  } else {
    json = decodeBase64Url(settings);
  }
  if (json === undefined) return false;
  try {
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------------
// Guarded browser access
// ---------------------------------------------------------------------------------------------

function local(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

function session(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage ?? undefined;
  } catch {
    return undefined;
  }
}

function read(store: Storage | undefined, key: string): string | undefined {
  try {
    return store?.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function write(store: Storage | undefined, key: string, value: string | undefined): void {
  try {
    if (value === undefined) store?.removeItem(key);
    else store?.setItem(key, value);
  } catch {
    // Full or refused. The copy still works for this page; it is only not remembered.
  }
}

function isStandalone(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
    return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

function currentHash(): string {
  try {
    return window.location.hash ?? "";
  } catch {
    return "";
  }
}

function isRecord(value: unknown): value is CopyRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && COPY_ID_PATTERN.test(record.id)
    && typeof record.created === "number" && Number.isFinite(record.created)
    && typeof record.opened === "number" && Number.isFinite(record.opened)
    && (record.from === undefined || (typeof record.from === "string" && /^[0-9a-f]{8}$/.test(record.from)))
    && (record.title === undefined || (typeof record.title === "string" && record.title.length <= 200));
}

function readRegistry(): CopyRecord[] {
  const raw = read(local(), REGISTRY_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecord).slice(0, MAX_REMEMBERED_COPIES) : [];
  } catch {
    return [];
  }
}

function writeRegistry(records: CopyRecord[]): void {
  const sorted = [...records].sort((a, b) => b.opened - a.opened).slice(0, MAX_REMEMBERED_COPIES);
  write(local(), REGISTRY_KEY, JSON.stringify(sorted));
}

function isKnown(id: CopyId): boolean {
  return readRegistry().some((record) => record.id === id) || read(local(), SETTINGS_PREFIX + id) !== undefined;
}

function remember(id: CopyId, settings: string | undefined, created: boolean): void {
  const now = Date.now();
  const records = readRegistry();
  const existing = records.find((record) => record.id === id);
  const record: CopyRecord = existing
    ? { ...existing, opened: now }
    : { id, created: now, opened: now, ...(created && settings !== undefined ? { from: settingsFingerprint(settings) } : {}) };
  // First, so it stays first among copies opened in the same millisecond (the sort is stable).
  writeRegistry([record, ...records.filter((entry) => entry.id !== id)]);
}

/**
 * Rewrite the address bar's fragment to `k=<id>[&c=<settings>]`, keeping every other part
 * (`move=`, an app's own `#section`). `history.state` is kept: Next.js's router lives in it.
 */
function rewriteBar(id: CopyId, settings: string | undefined): void {
  try {
    const parts = [`k=${id}`, ...(settings === undefined ? [] : [`c=${settings}`]), ...otherParts(currentHash())];
    const { pathname, search } = window.location;
    const next = `${pathname}${search}#${parts.join("&")}`;
    if (`${pathname}${search}${currentHash()}` !== next) window.history.replaceState(window.history.state, "", next);
  } catch {
    // No history API (a sandboxed frame): the copy still opens; only the bar keeps the old link.
  }
}

// ---------------------------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------------------------

function resolve(): CopyResolution {
  const fragment = readFragment(currentHash());
  const linkSettings = fragment.c !== undefined && fragment.c !== "" ? fragment.c : undefined;
  const linkId = fragment.k !== undefined && COPY_ID_PATTERN.test(fragment.k) ? fragment.k : undefined;

  if (linkSettings !== undefined && !isReadableSettings(linkSettings)) {
    // A known `k` beside a damaged `c` is still that copy: its stored settings win anyway.
    if (!(linkId && isKnown(linkId))) return { kind: "original", unreadableLink: true };
  }

  if (linkId) {
    if (isKnown(linkId)) {
      const stored = read(local(), SETTINGS_PREFIX + linkId);
      return open(linkId, stored ?? (linkSettings && isReadableSettings(linkSettings) ? linkSettings : undefined), false, "link");
    }
    return open(linkId, linkSettings, true, "link");
  }

  if (linkSettings !== undefined) {
    const id = copyIdFor(linkSettings);
    const known = isKnown(id);
    const stored = known ? read(local(), SETTINGS_PREFIX + id) : undefined;
    return open(id, stored ?? linkSettings, !known, "link");
  }

  const tab = read(session(), TAB_KEY);
  if (tab && COPY_ID_PATTERN.test(tab)) return open(tab, read(local(), SETTINGS_PREFIX + tab), false, "tab");

  if (isStandalone()) {
    const last = read(local(), STANDALONE_KEY);
    if (last && COPY_ID_PATTERN.test(last)) {
      return open(last, read(local(), SETTINGS_PREFIX + last), false, "home-screen");
    }
    write(local(), STANDALONE_KEY, "original");
  }
  return ORIGINAL;
}

function open(id: CopyId, settings: string | undefined, created: boolean, via: "link" | "tab" | "home-screen"): CopyResolution {
  activeSettings = settings;
  if (settings !== undefined) write(local(), SETTINGS_PREFIX + id, settings);
  remember(id, settings, created);
  write(session(), TAB_KEY, id);
  if (isStandalone()) write(local(), STANDALONE_KEY, id);
  rewriteBar(id, settings);
  return Object.freeze({ kind: "copy", id, created, via });
}

/**
 * Which copy this page load is: decided on the first call (the table at the top of this file),
 * cached for the page's life. On the server it is always the original, and nothing is cached
 * there, because a server module is shared by every request.
 */
export function activeCopy(): CopyResolution {
  if (typeof window === "undefined") return ORIGINAL;
  resolved ??= resolve();
  return resolved;
}

/** What Dexie opens: `name` for the original, `name~<id>` for a copy. */
export function storageNameFor(name: string, resolution: CopyResolution = activeCopy()): string {
  return resolution.kind === "copy" ? `${name}~${resolution.id}` : name;
}

/**
 * A `localStorage` or `sessionStorage` key for this copy: `key` for the original, `key~<id>` for a
 * copy. Every key an application names by hand goes through this, or copies share it.
 */
export function copyKey(key: string): string {
  return storageNameFor(key);
}

/** The stored settings string of a copy (its `c` value), or undefined. */
export function copySettings(id: CopyId): string | undefined {
  const stored = read(local(), SETTINGS_PREFIX + id);
  if (stored !== undefined) return stored;
  const active = resolved;
  return active?.kind === "copy" && active.id === id ? activeSettings : undefined;
}

/** Replace a copy's stored settings and, when it is the open copy, rewrite the address bar to them. */
export function saveCopySettings(id: CopyId, settings: string | undefined): void {
  if (!COPY_ID_PATTERN.test(id)) return;
  if (settings !== undefined && !isReadableSettings(settings)) return;
  write(local(), SETTINGS_PREFIX + id, settings);
  const active = resolved;
  if (active?.kind === "copy" && active.id === id) {
    activeSettings = settings;
    rewriteBar(id, settings);
  }
  for (const listener of listeners) listener();
}

/** Remember the copy's title, so an "open your copy" message can name it. */
export function labelCopy(id: CopyId, title: string): void {
  const records = readRegistry();
  const record = records.find((entry) => entry.id === id);
  const trimmed = title.trim().slice(0, 200);
  if (!record || record.title === trimmed) return;
  record.title = trimmed;
  writeRegistry(records);
}

/** Called after `saveCopySettings` changes a copy's settings. Returns the unsubscribe. */
export function subscribeCopies(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Copies this browser knows, most recently opened first (at most 20 remembered). */
export function listCopies(): CopyRecord[] {
  return readRegistry().sort((a, b) => b.opened - a.opened);
}

/** The address of a copy on this origin: `<origin><path>#k=<id>[&c=<settings>]`. */
export function copyHref(id: CopyId): string {
  const settings = copySettings(id);
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#k=${id}${settings === undefined ? "" : `&c=${settings}`}`;
}

/**
 * An address with the copy id (and any `move=` code) removed and the settings kept: what a share
 * should send. A recipient gets the same settings and a copy of their own; none of the sender's
 * data travels, because it never was in the address.
 */
export function shareableHref(href?: string): string {
  const source = href ?? (typeof window === "undefined" ? "" : window.location.href);
  const hashAt = source.indexOf("#");
  if (hashAt < 0) return source;
  const base = source.slice(0, hashAt);
  const fragment = readFragment(source.slice(hashAt));
  const kept = [
    ...(fragment.c !== undefined && fragment.c !== "" ? [`c=${fragment.c}`] : []),
    ...otherParts(source.slice(hashAt), true),
  ];
  return kept.length === 0 ? base : `${base}#${kept.join("&")}`;
}
