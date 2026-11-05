# Home screen and offline

This app can be put on a phone's home screen with its own icon and name, opens full screen from
there, and opens without a connection after one visit. It is all in place: nothing to call or
add.

## What ships

- `public/sw.js`: the offline copy. It keeps the home page and every file it loads, serves pages
  from the network first and from the copy when offline, and never keeps an error page, a
  redirect or another site's files.
- `components/home-screen.tsx`: `<HomeScreen />`, mounted in `app/providers.tsx`. It registers the
  copy in a built app (never in development or on localhost) and renders the two below.
- `components/install-card.tsx`: a one-time card on phones. On an iPhone or iPad in Safari it shows
  the three Share-menu steps; on Android it offers the browser's own install dialog from a button
  labelled "Install". The label is deliberate: the check presses the first button whose label starts
  with "Add", "New" or "Create" as the app's main action, so no button of the card may start that
  way. It shows once per browser, never when the app is already on the home screen.
- `components/save-as-app.tsx`: a small "Save as app" button in the bottom-right corner of every
  page. In Chrome and Edge it opens the browser's own install dialog, else on Android the menu
  steps; on an iPhone or iPad it shows the Share-menu steps, in Safari on a Mac the "Add to Dock"
  steps. Never in Firefox on a computer, from the home screen or once installed. It is the app's
  only install control: do not move it or add another.
- `lib/home-screen.ts`: the decisions and words behind both, the held install prompt, and
  `isStandalone(window)`: whether the app is running from the home screen.
- `app/manifest.ts`, `app/identity.ts` and the icons: the name under the icon is
  `homeScreenName`, which follows `identity.name`.

## Rules

- **Do not edit, move or remove these files**, and keep `<HomeScreen />` in `app/providers.tsx`.
- **Do not add another service worker, manifest or install prompt**: no `next-pwa`, Serwist or
  Workbox, no second `sw.js`, no install button of your own, and no `navigator.serviceWorker`
  call anywhere else.
- **Keep `id`, `start_url`, `scope` and `display` in `app/manifest.ts` as they are.** The name,
  description and colours there come from `app/identity.ts` and `app/icon-art.tsx`; change them
  there. If you change `--background` in `app/globals.css`, change `PAGE` in `app/icon-art.tsx`
  to the same value: it is the launch screen's colour.
- **Do not set `Cache-Control: no-store`** on pages or add headers to `/sw.js`.

## Writing pages that work offline

- The home page renders from what is stored on the device, never from a request made on load.
- Anything that needs the internet (the AI helper, a third-party API, moving data to another
  device) shows its own "You're offline" message instead of failing. `askModel` already returns
  `offline`.
- Anything fixed to the bottom of the screen takes `pb-safe` (and the top `pt-safe`), so it clears
  a phone's home indicator and notch. Use `min-h-dvh`, not `h-screen`.
- The bottom-right corner, about 6rem high and 10rem wide, holds the Save as app control: keep
  fixed bars and floating buttons clear of it or on the left.
- `isStandalone(window)` may hide something that only makes sense in a browser tab. Read it after
  the page mounts, never during render.

The app cannot send notifications or reminders while it is closed: never promise them.
