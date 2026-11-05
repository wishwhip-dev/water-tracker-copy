"use client";

import { QueryClient, useMutation, useQuery, type QueryKey } from "@tanstack/react-query";

/**
 * Every network request this app makes goes through this file. It is the only file in the app that
 * may call `fetch`, beside `lib/ai.ts` in an app with the AI helper; it holds no AI code.
 *
 * - `usePublicQuery(url)` reads a public API that needs no key, straight from the browser.
 * - `useCall(name, path, params)` reaches one of the calls this app is given, through the app's own
 *   address (`/_wishwhip/call/<name>/<path>`), where WishWhip adds the key. There is never a key in
 *   the app.
 * - `useAppQuery` and `useAppMutation` wrap any other request made with `appFetch`.
 * - `apiFetch(route, init)` reaches the app's own address for anything else WishWhip serves there
 *   (`lib/data.ts` uses it for shared data), and `apiUpload(route, file)` sends a file there
 *   (`lib/uploads.ts` uses it for uploaded files).
 *
 * Nothing here throws. Every request ends as `{ ok: true, data }` or
 * `{ ok: false, reason, message }`, and `message` is written for the screen. A request has a
 * 10-second limit, sends no cookies, and is tried again once only when the network failed.
 *
 * Client-only, hence the directive. `docs/query.md` has the worked examples.
 */

/** Why a request has no answer. `message` says it for the screen. */
export type AppFailureReason =
  | "offline" | "timeout" | "cancelled" | "not-configured" | "paused" | "forbidden" | "not-found"
  | "rate-limited" | "daily-limit" | "bad-request" | "method" | "upstream" | "too-large" | "unsupported-type" | "redirect"
  | "unreadable" | "stub" | "no-data" | "conflict" | "schema" | "storage-limit" | "no-uploads" | "files-limit" | "too-big"
  | "no-live" | "live-limit";

export type AppFailure = {
  ok: false;
  reason: AppFailureReason;
  message: string;
  /** The HTTP status, when the server answered. */
  status?: number;
  /** The outside service's own status, when the app API says it answered with an error (`upstream`). */
  upstreamStatus?: number;
  /** When the server said how long to wait before trying again. */
  retryAfterSeconds?: number;
  /** On a `conflict`: the newest copy of what was being changed, when the server sent it. */
  latest?: unknown;
  /** On a `too-big` upload: the largest file the collection takes, in bytes, when the server said. */
  maxBytes?: number;
};

export type AppResult<T> = { ok: true; data: T } | AppFailure;

/** The query string a request carries. `undefined` and `null` values are left out. */
export type QueryParams = Readonly<Record<string, string | number | boolean | null | undefined | readonly (string | number | boolean)[]>>;

/** The methods a request may use. Only the app's own address takes the last three (`lib/data.ts`). */
export type AppMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type AppRequestInit = {
  method?: AppMethod;
  /** Sent as JSON. */
  body?: unknown;
  params?: QueryParams;
  /** Sent as `If-Match`: the version a change expects, so a newer one answers `conflict`. */
  ifMatch?: string | number;
  /** TanStack passes one to every query function; pass it on so a cancelled query stops. */
  signal?: AbortSignal;
};

/** The longest any request may take. */
export const REQUEST_TIMEOUT_MS = 10_000;

const MESSAGES: Record<AppFailureReason, string> = {
  offline: "Couldn't connect. Check your connection and try again.",
  timeout: "That took too long. Try again.",
  cancelled: "The request was stopped.",
  "not-configured": "This part of the app isn't set up yet.",
  paused: "This isn't available right now. Try again later.",
  forbidden: "This app isn't allowed to make that request.",
  "not-found": "That couldn't be found.",
  "rate-limited": "That's a lot of requests at once. Wait a moment and try again.",
  "daily-limit": "This app has reached today's limit. It works again tomorrow.",
  "bad-request": "That request couldn't be made.",
  method: "That request couldn't be made.",
  upstream: "The service didn't answer. Try again in a moment.",
  "too-large": "The answer was too large to load.",
  "unsupported-type": "The answer wasn't in a form this app can read.",
  redirect: "The service sent the request somewhere else, so it was stopped.",
  unreadable: "The answer couldn't be read. Try again.",
  stub: "Live data isn't available here.",
  "no-data": "Shared data isn't set up for this app.",
  conflict: "Someone else changed this just now. Try again.",
  schema: "That item doesn't match what this app stores.",
  "storage-limit": "This app has stored as much as it can. Remove some items to add more.",
  "no-uploads": "Uploaded files aren't set up for this app.",
  "files-limit": "This app has stored as many files as it can. Remove some to add more.",
  "too-big": "That file is too big (up to 25 MB).",
  "no-live": "Live updates aren't set up for this app.",
  "live-limit": "Too many people are connected right now; try again in a moment.",
};

/**
 * The words for an `upstream` failure, which is two different things: the service never answered
 * (no `upstreamStatus`), or it answered with an error of its own. Saying "didn't answer" for the
 * second sends a person to retry what will fail again; "couldn't find that" tells them to change
 * what they asked for.
 */
export function upstreamMessage(upstreamStatus: number | undefined): string {
  if (upstreamStatus === undefined) return MESSAGES.upstream;
  if (upstreamStatus === 404 || upstreamStatus === 410) return "The service couldn't find that. Try something else.";
  if (upstreamStatus === 400 || upstreamStatus === 422) return "The service couldn't use that. Check what you entered and try again.";
  if (upstreamStatus === 401 || upstreamStatus === 403) return "The service turned this request down.";
  if (upstreamStatus === 429) return MESSAGES["rate-limited"];
  if (upstreamStatus >= 500) return "The service had a problem. Try again in a moment.";
  return "The service answered with an error. Try again in a moment.";
}

function isReason(value: unknown): value is AppFailureReason {
  return typeof value === "string" && Object.hasOwn(MESSAGES, value);
}

/** A failure with its on-screen words. */
export function failure(
  reason: AppFailureReason,
  extra: { status?: number; upstreamStatus?: number; retryAfterSeconds?: number; message?: string; latest?: unknown; maxBytes?: number } = {},
): AppFailure {
  return {
    ok: false,
    reason,
    message: extra.message || MESSAGES[reason],
    ...(extra.status !== undefined ? { status: extra.status } : {}),
    ...(extra.upstreamStatus !== undefined ? { upstreamStatus: extra.upstreamStatus } : {}),
    ...(extra.retryAfterSeconds ? { retryAfterSeconds: extra.retryAfterSeconds } : {}),
    ...(extra.latest !== undefined ? { latest: extra.latest } : {}),
    ...(extra.maxBytes !== undefined ? { maxBytes: extra.maxBytes } : {}),
  };
}

/** Failures worth one more try: the network, not the server's answer. */
function retryable(result: AppFailure): boolean {
  return result.reason === "offline" || result.reason === "timeout";
}

/** A QueryClient for this app: answers stay fresh for a minute, and only a network failure is tried again. */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => failureCount < 1 && error instanceof NetworkFailure,
      },
      mutations: { retry: false },
    },
  });
}

/** The app API's base, `/_wishwhip` where it is set up; empty in a server-hosted app and in `next dev`. */
function apiBase(): string {
  return process.env.NEXT_PUBLIC_WISHWHIP_API_BASE ?? "";
}

/** A route on the app API: `apiPath("/call/weather/daily")` is `/_wishwhip/call/weather/daily`. */
export function apiPath(route: string): string {
  return `${apiBase()}${route}`;
}

/** `?a=1&b=2`, or "" for none. Arrays repeat the name. */
export function queryString(params: QueryParams | undefined): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    for (const item of Array.isArray(value) ? value : [value]) search.append(name, String(item));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

const CALL_NAME = /^[a-z][a-z0-9-]{0,39}$/;

/**
 * The path a call goes to, or undefined when the name or the path cannot be one: each segment is
 * encoded, and an empty, `.` or `..` segment is refused rather than sent.
 */
export function callPath(name: string, path: string, params?: QueryParams): string | undefined {
  if (!CALL_NAME.test(name)) return undefined;
  const trimmed = path.replace(/^\/+/, "");
  const segments = trimmed ? trimmed.split("/") : [];
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return undefined;
  return `${apiPath(`/call/${name}/${segments.map(encodeURIComponent).join("/")}`)}${queryString(params)}`;
}

/**
 * What the build check's browser installs to answer requests itself (`window.__wishwhipApiStub`).
 * `ifMatch` is the `If-Match` a change sends (`lib/data.ts`), as text. An upload (`apiUpload`) is
 * `{ url, method: "PUT", body: <the File or Blob itself>, contentType }`; its answer is the app
 * API's own JSON body, as `{ ok: true, data: <body> }`.
 */
export type ApiStubRequest = { url: string; method: AppMethod; body?: unknown; ifMatch?: string; contentType?: string };
type ApiStub = { answer?: (request: ApiStubRequest) => unknown };

/** An answer from the stub as an `AppResult`; undefined when it chose not to answer. */
function fromStub(answer: unknown): AppResult<unknown> | undefined {
  if (answer === undefined) return undefined;
  if (answer && typeof answer === "object" && "ok" in answer) {
    const shaped = answer as { ok: unknown; data?: unknown; reason?: unknown; latest?: unknown; maxBytes?: unknown };
    if (shaped.ok === true) return { ok: true, data: shaped.data };
    if (shaped.ok === false) {
      const reason = isReason(shaped.reason) ? shaped.reason : "stub";
      return failure(reason, { latest: shaped.latest, ...(reason === "too-big" ? { maxBytes: positive(shaped.maxBytes) } : {}) });
    }
  }
  return { ok: true, data: answer };
}

async function askStub(request: ApiStubRequest): Promise<AppResult<unknown> | undefined> {
  const stub = (globalThis as { __wishwhipApiStub?: ApiStub }).__wishwhipApiStub;
  if (typeof stub?.answer !== "function") return undefined;
  try {
    return fromStub(await stub.answer(request));
  } catch {
    return failure("stub");
  }
}

/** The caller's signal and the timeout together; the timeout alone where the browser cannot combine them. */
function requestSignal(signal: AbortSignal | undefined): { signal?: AbortSignal; timeout?: AbortSignal } {
  const timeout = typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined;
  if (!signal) return { signal: timeout, timeout };
  if (!timeout) return { signal };
  return { signal: typeof AbortSignal.any === "function" ? AbortSignal.any([signal, timeout]) : signal, timeout };
}

function retryAfter(header: string | null, body: unknown): number | undefined {
  const fromBody = body && typeof body === "object" ? (body as { retryAfterSeconds?: unknown }).retryAfterSeconds : undefined;
  const value = typeof fromBody === "number" ? fromBody : Number(header);
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : undefined;
}

/** A reason from the status alone, for an answer whose body names none. */
function statusReason(status: number): AppFailureReason {
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 405) return "method";
  if (status === 413) return "too-large";
  if (status === 429) return "rate-limited";
  if (status === 504) return "timeout";
  if (status >= 400 && status < 500) return "bad-request";
  return "upstream";
}

/**
 * The app API's failure body, `{ ok: false, reason, status?, retryAfterSeconds?, latest? }`, which it
 * sends with every non-2xx answer: not-configured 404, paused 503, forbidden 403, bad-request 400 or
 * 415, method 405, too-large 413, rate-limited and daily-limit (the app's allowance for today is used
 * up) 429, upstream, redirect, unsupported-type and a too-large answer 502, timeout 504; for shared
 * data also no-data 404, schema 400, conflict 412 (with the newest copy as `latest`) and
 * storage-limit 507; for uploaded files also no-uploads 404, conflict 409, too-big 413,
 * unsupported-type 415 and files-limit 507; for live updates (`lib/live.ts`, which opens its own
 * connection) also no-live 404 and live-limit 429.
 */
/** A positive whole number, or undefined. */
function positive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function apiFailure(body: unknown): { reason: AppFailureReason; upstreamStatus?: number; latest?: unknown; maxBytes?: number } | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const { ok, reason, status, latest, maxBytes } = body as { ok?: unknown; reason?: unknown; status?: unknown; latest?: unknown; maxBytes?: unknown };
  if (ok !== false || !isReason(reason)) return undefined;
  const limit = reason === "too-big" ? positive(maxBytes) : undefined;
  return {
    reason,
    ...(typeof status === "number" ? { upstreamStatus: status } : {}),
    ...(reason === "conflict" && latest !== undefined ? { latest } : {}),
    ...(limit !== undefined ? { maxBytes: limit } : {}),
  };
}

/** What the check's stub is told of a request. */
function stubRequest(url: string, init: AppRequestInit): ApiStubRequest {
  return {
    url,
    method: init.method ?? "GET",
    ...(init.body !== undefined ? { body: init.body } : {}),
    ...(init.ifMatch !== undefined ? { ifMatch: String(init.ifMatch) } : {}),
  };
}

async function send<T>(url: string, init: AppRequestInit, ownApp: boolean, stubAsked = false): Promise<AppResult<T>> {
  const method = init.method ?? "GET";
  const stubbed = stubAsked ? undefined : await askStub(stubRequest(url, init));
  if (stubbed) return stubbed as AppResult<T>;

  let body: string | undefined;
  try {
    body = init.body === undefined ? undefined : JSON.stringify(init.body);
  } catch {
    return failure("bad-request");
  }
  const headers: Record<string, string> = { accept: "application/json" };
  // The app's own header only on its own address: on another site it would make the browser ask
  // first (a preflight), which most public APIs do not answer.
  if (ownApp) headers["x-wishwhip-app"] = "1";
  if (body !== undefined) headers["content-type"] = "application/json";
  if (ownApp && init.ifMatch !== undefined) headers["if-match"] = String(init.ifMatch);
  const { signal, timeout } = requestSignal(init.signal);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body,
      signal,
      credentials: "omit",
      ...(ownApp ? {} : { referrerPolicy: "no-referrer" as const, mode: "cors" as const }),
    });
  } catch {
    if (timeout?.aborted) return failure("timeout");
    if (init.signal?.aborted) return failure("cancelled");
    return failure("offline");
  }

  // A non-2xx answer is a failure, never an exception: its JSON body names the reason when it has one.
  // A 2xx answer is the service's own body, passed through: parsed JSON, the text, or null for 204.
  if (response.status === 204) return { ok: true, data: null as T };
  const type = response.headers.get("content-type") ?? "";
  let data: unknown;
  try {
    data = /\bjson\b/i.test(type) ? await response.json() : await response.text();
  } catch {
    if (timeout?.aborted) return failure("timeout");
    return response.ok ? failure("unreadable", { status: response.status }) : failure(statusReason(response.status), { status: response.status });
  }
  return answered<T>(response.status, data, response.headers.get("retry-after"));
}

/** A read answer as an `AppResult`: a 2xx is its body, anything else the failure its body or status names. */
function answered<T>(status: number, data: unknown, retryAfterHeader: string | null): AppResult<T> {
  if (status < 200 || status > 299) {
    const named = apiFailure(data);
    const reason = named?.reason ?? statusReason(status);
    return failure(reason, {
      status,
      ...(named?.upstreamStatus !== undefined ? { upstreamStatus: named.upstreamStatus } : {}),
      ...(named?.latest !== undefined ? { latest: named.latest } : {}),
      ...(named?.maxBytes !== undefined ? { maxBytes: named.maxBytes } : {}),
      retryAfterSeconds: retryAfter(retryAfterHeader, data),
      // The service answered with an error of its own: say which kind, not that it never answered.
      ...(reason === "upstream" ? { message: upstreamMessage(named?.upstreamStatus) } : {}),
    });
  }
  return { ok: true, data: data as T };
}

/**
 * A request to this app's own address (a path starting with `/`). Never throws.
 *
 *   const result = await appFetch<Forecast>(callPath("weather", "daily", { q: city })!);
 */
export async function appFetch<T = unknown>(path: string, init: AppRequestInit = {}): Promise<AppResult<T>> {
  if (!path.startsWith("/") || path.startsWith("//")) return failure("bad-request");
  return send<T>(`${path}${queryString(init.params)}`, init, true);
}

/**
 * A request to the app API on this app's own address: `apiFetch("/data/notes")` is
 * `/_wishwhip/data/notes`. Answers `not-configured` without a request where the app API is not set
 * up (in `next dev`, or an app hosted on a server). Never throws.
 */
export async function apiFetch<T = unknown>(route: string, init: AppRequestInit = {}): Promise<AppResult<T>> {
  if (!route.startsWith("/") || route.startsWith("//")) return failure("bad-request");
  const target = `${apiPath(route)}${queryString(init.params)}`;
  const stubbed = await askStub(stubRequest(target, init));
  if (stubbed) return stubbed as AppResult<T>;
  // For a person's own `next dev`, where there is no app API to reach. The supervisor never sets it.
  if (process.env.NEXT_PUBLIC_WISHWHIP_API_STUB === "1") return failure("stub");
  if (!apiBase()) return failure("not-configured");
  return send<T>(target, init, true, true);
}

/** The shortest time limit an upload has: two minutes, however small the file. */
export const UPLOAD_TIMEOUT_MS = 120_000;

/**
 * How long an upload of `bytes` may take: two minutes, or long enough at 50 KB a second, whichever is
 * longer (a 25 MB file has about 500 seconds).
 */
export function uploadTimeoutMs(bytes: number): number {
  return Math.max(UPLOAD_TIMEOUT_MS, Math.ceil((Number.isFinite(bytes) && bytes > 0 ? bytes : 0) / 50));
}

export type UploadInit = {
  /** Sent as `Content-Type`. Default: the file's own type, else `application/octet-stream`. */
  contentType?: string;
  /** Told how much has been sent, from 0 to 1, while it is on its way (where the browser can say). */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

/** The caller's signal and the upload's own time limit together. */
function uploadSignal(signal: AbortSignal | undefined, limitMs: number): { signal?: AbortSignal; timeout?: AbortSignal } {
  const timeout = typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(limitMs) : undefined;
  if (!signal) return { signal: timeout, timeout };
  if (!timeout) return { signal };
  return { signal: typeof AbortSignal.any === "function" ? AbortSignal.any([signal, timeout]) : signal, timeout };
}

/** A body read as JSON when its type says so, else as text; undefined when it cannot be read. */
function readBody(type: string, text: string): { data: unknown } | undefined {
  if (!/\bjson\b/i.test(type)) return { data: text };
  try {
    return { data: JSON.parse(text) };
  } catch {
    return undefined;
  }
}

/** The upload through `XMLHttpRequest`, the one way a browser reports how much of a body has gone. */
function uploadWithProgress<T>(url: string, file: Blob, headers: Record<string, string>, init: UploadInit): Promise<AppResult<T>> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    let settledResult = false;
    const finish = (result: AppResult<T>) => {
      if (settledResult) return;
      settledResult = true;
      init.signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };
    const onAbort = () => {
      request.abort();
      finish(failure("cancelled"));
    };
    request.open("PUT", url);
    request.timeout = uploadTimeoutMs(file.size);
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) init.onProgress?.(Math.min(1, event.loaded / event.total));
    };
    request.onload = () => {
      if (request.status === 204) return finish({ ok: true, data: null as T });
      const body = readBody(request.getResponseHeader("content-type") ?? "", request.responseText);
      if (!body) return finish(request.status >= 200 && request.status < 300 ? failure("unreadable", { status: request.status }) : failure(statusReason(request.status), { status: request.status }));
      finish(answered<T>(request.status, body.data, request.getResponseHeader("retry-after")));
    };
    request.onerror = () => finish(failure("offline"));
    request.ontimeout = () => finish(failure("timeout"));
    request.onabort = () => finish(failure("cancelled"));
    if (init.signal?.aborted) return onAbort();
    init.signal?.addEventListener("abort", onAbort);
    request.send(file);
  });
}

/**
 * A file sent to the app API on this app's own address, as the body of a `PUT`:
 * `apiUpload("/uploads/photos/<id>", file)` is `PUT /_wishwhip/uploads/photos/<id>` with the file's
 * type as `Content-Type`. `lib/uploads.ts` uses it; call `uploadFile` there instead. Asks the check's
 * stub first; answers `not-configured` without a request where the app API is not set up. With
 * `onProgress` it goes through `XMLHttpRequest`, which reports progress; otherwise through `fetch`.
 * The time limit grows with the file (`uploadTimeoutMs`: at least two minutes, 50 KB a second), not
 * the 10 seconds a request has. Apps use no cookies: the fetch path sends none, and the app's own
 * address sets none for the `XMLHttpRequest` path to carry. It is never tried
 * again by itself. Never throws.
 */
export async function apiUpload<T = unknown>(route: string, file: Blob, init: UploadInit = {}): Promise<AppResult<T>> {
  if (!route.startsWith("/") || route.startsWith("//")) return failure("bad-request");
  const target = apiPath(route);
  const contentType = init.contentType || file.type || "application/octet-stream";
  const stubbed = await askStub({ url: target, method: "PUT", body: file, contentType });
  if (stubbed) return stubbed as AppResult<T>;
  // For a person's own `next dev`, where there is no app API to reach. The supervisor never sets it.
  if (process.env.NEXT_PUBLIC_WISHWHIP_API_STUB === "1") return failure("stub");
  if (!apiBase()) return failure("not-configured");
  const headers: Record<string, string> = { accept: "application/json", "x-wishwhip-app": "1", "content-type": contentType };
  if (init.onProgress && typeof XMLHttpRequest === "function") {
    try {
      return await uploadWithProgress<T>(target, file, headers, init);
    } catch {
      return failure("offline");
    }
  }
  const { signal, timeout } = uploadSignal(init.signal, uploadTimeoutMs(file.size));
  let response: Response;
  try {
    response = await fetch(target, { method: "PUT", headers, body: file, signal, credentials: "omit" });
  } catch {
    if (timeout?.aborted) return failure("timeout");
    if (init.signal?.aborted) return failure("cancelled");
    return failure("offline");
  }
  if (response.status === 204) return { ok: true, data: null as T };
  let text: string;
  try {
    text = await response.text();
  } catch {
    if (timeout?.aborted) return failure("timeout");
    return response.ok ? failure("unreadable", { status: response.status }) : failure(statusReason(response.status), { status: response.status });
  }
  const body = readBody(response.headers.get("content-type") ?? "", text);
  if (!body) return response.ok ? failure("unreadable", { status: response.status }) : failure(statusReason(response.status), { status: response.status });
  return answered<T>(response.status, body.data, response.headers.get("retry-after"));
}

/** An absolute `https:` address with no user name or password in it; undefined otherwise. */
export function publicUrl(url: string, params?: QueryParams): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) return undefined;
  const extra = queryString(params);
  if (extra) {
    for (const [name, value] of new URLSearchParams(extra.slice(1))) parsed.searchParams.append(name, value);
  }
  return parsed.toString();
}

/** A GET to a public API that needs no key: no cookies, no referrer. Never throws. */
export async function publicFetch<T = unknown>(url: string, init: Omit<AppRequestInit, "method" | "body"> = {}): Promise<AppResult<T>> {
  const target = publicUrl(url, init.params);
  if (!target) return failure("bad-request");
  return send<T>(target, { signal: init.signal }, false);
}

export type CallOptions = { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal };

/**
 * One of this app's calls, by name (`callApi("weather", "daily", { q: "Lisbon" })`). Answers
 * `not-configured` without a request where the app API is not set up. Never throws.
 */
export async function callApi<T = unknown>(name: string, path: string, params?: QueryParams, options: CallOptions = {}): Promise<AppResult<T>> {
  const target = callPath(name, path, params);
  if (!target) return failure("bad-request");
  const method = options.method ?? "GET";
  const stubbed = await askStub({ url: target, method, ...(options.body !== undefined ? { body: options.body } : {}) });
  if (stubbed) return stubbed as AppResult<T>;
  // For a person's own `next dev`, where there is no app API to reach. The supervisor never sets it.
  if (process.env.NEXT_PUBLIC_WISHWHIP_API_STUB === "1") return failure("stub");
  if (!apiBase()) return failure("not-configured");
  return send<T>(target, { method, body: options.body, signal: options.signal }, true, true);
}

/** A request function's result, or `bad-request` if it threw anyway: nothing reaches a component as an exception. */
async function settle<T>(fn: () => Promise<AppResult<T>>): Promise<AppResult<T>> {
  try {
    return await fn();
  } catch {
    return failure("bad-request");
  }
}

/** Thrown inside a query only, so TanStack tries a network failure once more; never reaches a component. */
class NetworkFailure extends Error {
  constructor(readonly result: AppFailure) {
    super(result.message);
    this.name = "NetworkFailure";
  }
}

export type AppQuery<T> = {
  /** The last answer: `{ ok: true, data }` or `{ ok: false, reason, message }`; undefined while the first is loading. */
  result: AppResult<T> | undefined;
  /** The data, once there is some. */
  data: T | undefined;
  /** The failure, when the last request failed. */
  failure: AppFailure | undefined;
  /** What to show for a failure, or "". */
  message: string;
  /** True until the first answer arrives. */
  loading: boolean;
  /** True whenever a request is on its way, the first one included. */
  fetching: boolean;
  /** Ask again, for a "Try again" button. */
  refetch: () => void;
};

export type AppQueryOptions = {
  /** False to wait, for a query that needs something the person has not entered yet. */
  enabled?: boolean;
  /** How long an answer stays fresh, in milliseconds. Default 60 seconds. */
  staleTime?: number;
};

/**
 * Any request made with `appFetch`, `publicFetch` or `callApi`, with its state, for a component.
 *
 *   const { data, loading, message, refetch } = useAppQuery(["rates", base], ({ signal }) => publicFetch<Rates>(url, { signal }));
 */
export function useAppQuery<T>(
  key: QueryKey,
  fn: (context: { signal: AbortSignal }) => Promise<AppResult<T>>,
  options: AppQueryOptions = {},
): AppQuery<T> {
  const query = useQuery<AppResult<T>, NetworkFailure>({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const result = await settle(() => fn({ signal }));
      if (!result.ok && retryable(result)) throw new NetworkFailure(result);
      return result;
    },
    enabled: options.enabled ?? true,
    ...(options.staleTime !== undefined ? { staleTime: options.staleTime } : {}),
  });
  // A network failure that outlived its retry is shown like any other; an older answer stays.
  const result: AppResult<T> | undefined = query.error ? query.error.result : query.data;
  const failed = result && !result.ok ? result : undefined;
  const latest = query.data?.ok ? query.data.data : undefined;
  return {
    result,
    data: result?.ok ? result.data : latest,
    failure: failed,
    message: failed?.message ?? "",
    loading: query.isPending && query.fetchStatus !== "idle",
    fetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    },
  };
}

/** A public API that needs no key, by its absolute `https:` address. A relative address answers `bad-request`. */
export function usePublicQuery<T>(url: string, options: AppQueryOptions & { params?: QueryParams } = {}): AppQuery<T> {
  return useAppQuery<T>(["public", url, options.params ?? {}], ({ signal }) => publicFetch<T>(url, { params: options.params, signal }), options);
}

/**
 * One of this app's calls, with its state: `useCall("weather", "daily", { q: city })` is
 * `GET /_wishwhip/call/weather/daily?q=…`. Only the calls the app is given exist.
 */
export function useCall<T>(name: string, path: string, params?: QueryParams, options: AppQueryOptions & Omit<CallOptions, "signal"> = {}): AppQuery<T> {
  const method = options.method ?? "GET";
  return useAppQuery<T>(
    ["call", name, path, params ?? {}, method, options.body ?? null],
    ({ signal }) => callApi<T>(name, path, params, { method, body: options.body, signal }),
    options,
  );
}

export type AppMutation<Input, T> = {
  /** Send it, from a click or a submit. Resolves with the result; never rejects. */
  run: (input: Input) => Promise<AppResult<T>>;
  result: AppResult<T> | undefined;
  /** What to show for a failure, or "". */
  message: string;
  /** True while it is on its way: disable the button so it is not pressed twice. */
  pending: boolean;
  reset: () => void;
};

/**
 * A request that changes something, sent from a click or a submit; never tried again by itself.
 *
 *   const save = useAppMutation((entry: Entry) => callApi("notes", "entries", undefined, { method: "POST", body: entry }));
 */
export function useAppMutation<Input, T>(fn: (input: Input) => Promise<AppResult<T>>): AppMutation<Input, T> {
  const mutation = useMutation<AppResult<T>, never, Input>({ mutationFn: (input) => settle(() => fn(input)) });
  const result = mutation.data;
  return {
    run: (input) => mutation.mutateAsync(input),
    result,
    message: result && !result.ok ? result.message : "",
    pending: mutation.isPending,
    reset: mutation.reset,
  };
}
