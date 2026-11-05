// This app's offline copy: after one visit it opens without a connection. Shipped by the
// home-screen module and registered by components/home-screen.tsx. Do not edit, move or replace
// it, and register no other service worker; docs/home-screen.md says what it does.
//
// - Install: keep the start page and every file it loads (read from its HTML, so whatever the
//   bundler named them), then take over at once.
// - Pages: from the network first, so people online always get the newest version; the kept copy
//   when the network fails or is slower than WAIT_MS; a short "you're offline" page when there is
//   none. An error page from the server is passed on, never replaced by the kept copy.
// - /_next/static/: kept the first time it is used and served from the copy after that. The file
//   names change with their contents, so a kept file is never stale.
// - Other files of this app (icons, the manifest, public/): the copy at once, refreshed behind it.
// - Never touched: anything but GET, other sites, /api/, /_wishwhip/ (the app's own data and
//   calls, always fresh), ranges, and Next's RSC data requests.
// - Only a plain 200 from this app is ever kept: no error, no redirect (a sign-in page), nothing
//   from another site. At most MAX_ENTRIES files; the oldest go first, the start page never.
// - A 404 or 410 for the start page means the app is gone: the copy deletes itself.
//
// VERSION is this file's own version. Changing it changes these bytes, so browsers install the new
// copy and delete every older one. A new build of the app needs no change here: its pages arrive
// from the network and the files they load are kept as they are used.

const VERSION = 1;
const CACHE = `ww-${VERSION}`;
const START = "/";
const WAIT_MS = 3500;
const MAX_ENTRIES = 250;
const MAX_SHELL = 150;
const MAX_WARM = 200;
const SKIP = /^\/(?:api\/|_wishwhip\/|_next\/webpack-hmr|_vercel\/|__nextjs|sw(?:-[a-z]+)?\.js$)/;
const SHELL_LINK = /<link\b[^>]*\brel="(?:stylesheet|preload|modulepreload|icon|apple-touch-icon|manifest)"[^>]*>/g;
const SHELL_SCRIPT = /<script\b[^>]*\bsrc="(\/_next\/static\/[^"#]+)"/g;
const WARMABLE = /^\/(?:_next\/static\/|icon\b|apple-icon\b|manifest\.webmanifest$)/;

// A seam for a later module that sends notices: it adds ?push=1 to this file's address and ships
// /sw-push.js, so this file never needs editing for it.
if (new URL(self.location.href).searchParams.get("push") === "1") {
  try {
    importScripts("/sw-push.js");
  } catch {
    // No notices, and everything else still works.
  }
}

/** Only a plain 200 from this app: never an error, a redirect, an opaque or another site's response. */
function keepable(response) {
  if (!response || response.status !== 200 || response.type !== "basic" || response.redirected) return false;
  try {
    return !response.url || new URL(response.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

function gone(response) {
  return response.status === 404 || response.status === 410;
}

/** The same-origin files a page loads, from its HTML. */
function shellUrls(html) {
  const urls = new Set();
  for (const match of html.matchAll(SHELL_SCRIPT)) urls.add(match[1]);
  for (const tag of html.match(SHELL_LINK) || []) {
    const href = /\bhref="(\/[^"#]+)"/.exec(tag);
    if (href && !href[1].startsWith("//")) urls.add(href[1]);
  }
  return [...urls].map((url) => url.replace(/&amp;/g, "&")).slice(0, MAX_SHELL);
}

/** Fetches and keeps one file, when what comes back may be kept. Never throws. */
async function keep(cache, url) {
  try {
    const response = await fetch(url, { credentials: "same-origin" });
    if (keepable(response)) await cache.put(url, response);
  } catch {
    // Missing from the copy; it is fetched again when it is next used.
  }
}

/** Drops the oldest entries over MAX_ENTRIES: pages and other files first, then /_next/static/, never the start page. */
async function trim(cache) {
  const keys = await cache.keys();
  let excess = keys.length - MAX_ENTRIES;
  if (excess <= 0) return;
  const path = (request) => new URL(request.url).pathname;
  const candidates = keys.filter((request) => path(request) !== START);
  const ordered = [
    ...candidates.filter((request) => !path(request).startsWith("/_next/static/")),
    ...candidates.filter((request) => path(request).startsWith("/_next/static/")),
  ];
  for (const request of ordered) {
    if (excess <= 0) break;
    await cache.delete(request);
    excess -= 1;
  }
}

async function put(cache, request, response) {
  await cache.put(request, response);
  await trim(cache);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const response = await fetch(START, { cache: "no-store", credentials: "same-origin" });
    // A start page that cannot be kept (an error, a sign-in redirect) fails the install; the next visit tries again.
    if (!keepable(response)) throw new Error("The start page cannot be kept offline.");
    const html = await response.clone().text();
    const cache = await caches.open(CACHE);
    await cache.put(START, response);
    await Promise.all(shellUrls(html).map((url) => keep(cache, url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith("ww-") && key !== CACHE) await caches.delete(key);
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.headers.has("range")) return;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || SKIP.test(url.pathname)) return;
  if (request.headers.get("rsc") === "1" || url.searchParams.has("_rsc")) return;
  if (request.mode === "navigate") return void event.respondWith(page(event, url));
  if (url.pathname.startsWith("/_next/static/")) return void event.respondWith(cacheFirst(event));
  event.respondWith(refreshing(event));
});

async function page(event, url) {
  const cache = await caches.open(CACHE);
  let kept = Promise.resolve();
  const network = Promise.resolve(event.preloadResponse)
    .then((preloaded) => preloaded || fetch(event.request))
    .then((response) => {
      if (gone(response) && url.pathname === START) kept = retire();
      else if (keepable(response)) kept = put(cache, url.href, response.clone());
      return response;
    });
  event.waitUntil(network.then(() => kept, () => undefined));
  try {
    // An HTTP error is returned as it is: online, the server's answer always wins.
    return await within(network, WAIT_MS);
  } catch {
    const cached = (await cache.match(url.href, { ignoreSearch: true, ignoreVary: true }))
      || (await cache.match(START, { ignoreVary: true }));
    return cached || network.catch(() => offlinePage());
  }
}

async function cacheFirst(event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(event.request, { ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(event.request);
  if (keepable(response)) event.waitUntil(put(cache, event.request, response.clone()));
  return response;
}

async function refreshing(event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(event.request, { ignoreVary: true });
  const fresh = fetch(event.request).then(async (response) => {
    if (keepable(response)) await put(cache, event.request, response.clone());
    return response;
  });
  event.waitUntil(fresh.catch(() => undefined));
  return cached || fresh;
}

// The page posts the files it loaded before this copy took over (components/home-screen.tsx).
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "warm" || !Array.isArray(data.urls)) return;
  const urls = data.urls
    .filter((url) => typeof url === "string" && url.startsWith("/") && !url.startsWith("//") && WARMABLE.test(url))
    .slice(0, MAX_WARM);
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const url of urls) if (!(await cache.match(url, { ignoreVary: true }))) await keep(cache, url);
    await trim(cache);
  })());
});

/** The app was taken down or deleted: forget the copy, so it stops opening once people are online. */
async function retire() {
  for (const key of await caches.keys()) if (key.startsWith("ww-")) await caches.delete(key);
  await self.registration.unregister();
}

function within(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("slow")), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

function offlinePage() {
  return new Response(
    "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
    + "<title>Offline</title><p style='font:16px/1.5 system-ui,sans-serif;padding:24px'>You're offline, and this page "
    + "hasn't been opened on this device yet. Connect and try again.</p>",
    { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
