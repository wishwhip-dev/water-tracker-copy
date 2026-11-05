# Requests

`@/lib/query` is the one place this app makes a network request. TanStack Query is installed and
already mounted (`app/providers.tsx`), and `lib/query.ts` wraps it so every request has the same
10-second limit, sends no cookies, is tried again once only when the network failed, and **never
throws**: it ends as `{ ok: true, data }` or `{ ok: false, reason, message }`.

**Never call `fetch` anywhere else**, and never install another request library. The build check
looks for `fetch(` outside this file. **Never put an API key in the app**: not in the code, not in
`.env`, not under a `NEXT_PUBLIC_` name. A key in the app is a key every visitor can read.

The AI module has its own hook, `useAsk`; see `docs/ai.md`. Shared data, where the app has it,
has its own hooks in `lib/data.ts`; see `docs/data.md`. Uploaded files, where the app has them,
have theirs in `lib/uploads.ts`; see `docs/uploads.md`. Live updates, where the app has them, have
theirs in `lib/live.ts`, the one file that opens a WebSocket; see `docs/live.md`.

## A Local app: no requests at all

Most apps need nothing from the internet. Their data stays in this browser (`docs/storage.md` where
the app has a database), and they make no request of their own. In a Local app, use none of the
hooks below; if the goal needs something online, say so in your summary.

## A Connected app

An app that may use the internet reaches two things, and nothing else:

- **A public API that needs no key**, straight from the browser, with `usePublicQuery`. The API must
  allow browser requests (CORS); most open-data APIs do.
- **A call this app is given**, by name, with `useCall`. It goes to the app's own address
  (`/_wishwhip/call/<name>/<path>`) and WishWhip adds the key there. Only the calls listed in your
  instructions exist; never invent one.

```tsx
"use client";
import { Button } from "@/components/ui/button";
import { usePublicQuery } from "@/lib/query";

type Forecast = { current: { temperature_2m: number } };

export function Temperature({ latitude, longitude }: { latitude: number; longitude: number }) {
  const { data, loading, message, refetch } = usePublicQuery<Forecast>("https://api.open-meteo.com/v1/forecast", {
    params: { latitude, longitude, current: "temperature_2m" },
  });
  if (loading) return <p role="status">Loading the temperature…</p>;
  if (message) return <p role="status">{message} <Button variant="outline" size="sm" onClick={refetch}>Try again</Button></p>;
  return <p>{data?.current.temperature_2m}°C now</p>;
}
```

```tsx
const { data, loading, message } = useCall<Daily>("weather", "daily", { q: city }, { enabled: city.length > 0 });
```

`useCall(name, path, params, { method, body, enabled })` builds `GET /_wishwhip/call/weather/daily?q=…`.
Use the paths and parameters your list of calls gives for that call, and read the answer by the
shape it shows; never guess a path (`daily` above is only an example);
`{ method: "POST", body }` sends JSON. Outside the live app (in `next dev`, or an app hosted on a
server) a call answers `not-configured` without a request, so show that state too.

## The other hooks

- `useAppQuery(key, fn, options)` runs any request function with the same state, for example
  `({ signal }) => publicFetch<Rates>(url, { signal })`. Pass `signal` on so a stale request stops.
- `useAppMutation(fn)` sends something from a click or a submit: `run(input)` resolves with the
  result and never rejects; `pending` disables the button; it is never tried again by itself.
- `appFetch`, `publicFetch` and `callApi` are the plain functions under the hooks, for an event
  handler. `apiFetch(route, init)` is the one `lib/data.ts` uses for the app's own address, and
  `apiUpload(route, file, { onProgress })` the one `lib/uploads.ts` uses to send a file there.

Each query hook returns `{ data, result, failure, message, loading, fetching, refetch }`. Answers
stay fresh for a minute, and nothing refetches when the window regains focus.

## Every state is on the page, as text

A request is never the only way the page shows something: render what the app has, then the answer
when it arrives. While loading, say so ("Loading the forecast…"). When `message` is not empty, show
it and a "Try again" button (`refetch`), and keep whatever the person entered. Never leave a blank,
a spinner that does not end, or a feature that disappears.

| `reason` | What happened |
| --- | --- |
| `offline`, `timeout` | the network failed or was too slow (tried once more already) |
| `cancelled` | the request was stopped because it was no longer needed; show nothing for it |
| `not-configured` | the call does not exist here: in `next dev`, a server-hosted app, or an unknown call |
| `paused` | requests are switched off for now |
| `upstream` | the service answered with an error (`upstreamStatus`; `message` says which kind, such as "couldn't find that") or not at all |
| `rate-limited` | too many requests in a minute; `retryAfterSeconds` says how long to wait |
| `daily-limit` | the app has used today's calls or shared-data requests; they work again after midnight UTC (`retryAfterSeconds`). Show `message`; no "Try again" button |
| `forbidden` | the request did not come from this app's own pages |
| `bad-request`, `method`, `not-found` | the request, its method or its address is wrong: fix the code |
| `too-large` | the request or the answer was too large (a request body up to 64 KB, an answer up to 1 MB) |
| `unsupported-type`, `redirect`, `unreadable` | the answer was not JSON or text, pointed elsewhere, or could not be read |
| `stub` | the build check answers every request this way: the page must show the failure state |
| `no-data`, `conflict`, `schema`, `storage-limit` | shared data only (`lib/data.ts`): see `docs/data.md` |
| `no-uploads`, `too-big`, `files-limit` | uploaded files only (`lib/uploads.ts`): see `docs/uploads.md` |
| `no-live`, `live-limit` | live updates only (`lib/live.ts`): see `docs/live.md` |

A successful answer is the service's own body: `data` is the parsed JSON, or the text when it is
plain text (`null` when there is none).

Fetch on screen, never in a loop: one request per thing shown, never per keystroke (wait for a
search to be submitted, or set `enabled` once the input is complete), and never on a timer.
