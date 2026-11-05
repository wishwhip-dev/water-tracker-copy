# Working in this project

A reviewed Next.js App Router starter. It builds and runs as-is; `app/page.tsx` is a placeholder
meant to be replaced by the product you are asked for.

Read this instead of exploring. It is the whole setup.

## What this project is for

A single-page web app that saves its data in the visitor's browser.

Good for: trackers and planners; calculators and converters; dashboards and charts over data you bring; small tools and text utilities; scoreboards, logs and anything that keeps a history of entries.

Not built for: sharing data between people or devices (data stays in one browser unless the person moves it with a code); accounts or sign-in; calling outside services or APIs.

A request that needs one of these is outside what this project can deliver as it stands: plan the closest thing it can, and say plainly what was left out.

## Stack

Next.js App Router · TypeScript · Tailwind CSS · shadcn/ui · 14 shadcn/ui components pre-installed (dialog, select, table, card, form inputs, tabs, alert) · Dexie (browser database, device-local) · Sonner (toast notifications, already mounted) · Browser notifications (lib/browser-notifications.ts: the permission read before asking; NotificationsSwitch) · Recharts (themed chart components, already wired to the palette) · Web Share (ShareButton and lib/share.ts: a result drawn to an image and shared or saved, a link shared or copied) · Home screen and offline (public/sw.js).

## Layout

```
app/identity.ts                      the app's name, description and colour; the title, icons, manifest and share image read it. Change them here.
app/layout.tsx                       root layout — <html>/<body>, <Providers>, and metadata read from identity.ts.
app/page.tsx                         the placeholder. Replace it.
app/globals.css                      Tailwind entry, the design tokens (its header says what the theme is), pb-safe, pb-bottom-bar and the base rules.
app/providers.tsx                    "use client" — composed from this project's modules. Already wired into layout.
types/webgpu.d.ts                    WebGPU types, for type-checking only. Nothing here may require WebGPU.
template.capabilities.json           what this template ships, declared for the planner. Keep it accurate.
components/ui/                       the shadcn components, already themed. See docs/components.md.
lib/utils.ts                         cn() — the className merge helper every shadcn component expects.
components.json                      shadcn config: new-york, neutral, rsc, aliases @/components and @/lib.
lib/storage/                         the shared storage package, vendored in. Do NOT edit; see docs/storage.md.
lib/db.ts                            THIS app's database schema. Tables, indexes, versions. Edit this.
lib/data/<name>.ts                   THIS app's queries. Components call these, never Dexie directly. Create it.
lib/browser-notifications.ts         the system notifications' permission (granted, blocked, unsupported) and asking for it.
components/notifications-switch.tsx  "Turn on notifications" with every state in words. Use it rather than calling Notification yourself.
components/ui/chart.tsx              the Recharts wrapper. Import from it; do not edit it.
lib/chart-periods.ts                 fillPeriods: a row for every month, week or day in a range, so an empty one is an empty bar.
components/share-button.tsx          the share control, with its outcome shown as text. Use it; do not call navigator.share.
lib/share.ts                         draw a share card, share or save an image, share or copy a link.
```

`@/*` resolves to the project root (`tsconfig.json` paths). Import as `@/components/ui/button`.

The app's name, description and colour live in `app/identity.ts`; change them there, never in
`layout.tsx`. The title, the icons, the manifest and the share image all read it. Wherever the page
shows the app's own name (a heading, a header, a footer), render `identity.name` from
`@/app/identity` rather than typing the name out, so a rename reaches it.

**That list is the entire project.** There is nothing else to discover, so do not spend steps
exploring for it. If you want to see the conventions before writing, the ones worth opening are
`app/layout.tsx`, `app/page.tsx`, `app/globals.css` and `package.json`.

## What this project ships

Each of these is already installed and already wired up. **Read the document before building on
one** — it carries the worked code, so you do not have to derive it, and it says what the thing
cannot do as well as what it can.

- **Component kit.** 14 shadcn/ui components, the design tokens they need, and the cn() helper. Read `docs/components.md` before building on it.
- **Browser storage.** Dexie over IndexedDB, already set up: schemas, seeding, live queries and export/import. Data lives in one browser on one device — no sync, no sharing between visitors, no server copy. Read `docs/storage.md` before building on it.
- **Toast notifications.** Sonner toasts, mounted and ready. Call toast() from anywhere on the client. Browser notifications with their permission read first (NotificationsSwitch). Read `docs/notifications.md` before building on it.
- **Charts.** Recharts, wrapped and themed as `ChartContainer`. Series colours follow the project's palette. Read `docs/charts.md` before building on it.
- **Sharing.** Share a result as an image sized for stories, posts or link previews, or share a link, with a save or copy fallback where the device has no share sheet. Read `docs/share.md` before building on it.
- **Move to another device.** The app's data moved to another device once, encrypted, with a code that lasts a day. Photos stay. Read `docs/sync.md` before building on it.
- **Home screen.** Installs on a phone's home screen and opens offline after one visit. Already mounted; never edit public/sw.js or add another service worker or install prompt. Read `docs/home-screen.md` before building on it.
- **Visit counts.** Counts how many times the app is opened, for its owner. Already mounted; nothing about visitors is kept. Read `docs/visits.md` before building on it.
- **Footer.** "Made with WishWhip · Report", in the layout. Keep it. Read `docs/attribution.md` before building on it.

Nothing outside the stack above is set up. In particular, unless a document above says otherwise,
there is no backend datastore and no authentication. **This app makes no network requests of its
own**: no API and nothing loaded from another site; its data stays in this browser. A request could
only ever go in `lib/query.ts`, and this app has none.

## Conventions

**Server components by default.** Add `"use client"` only to files that need state, effects,
event handlers or browser APIs. Keep the client boundary as low in the tree as you can — a page
can stay a server component with an interactive child island.

**Tailwind v4 has no `tailwind.config.js`.** Configuration lives in CSS. Add design tokens with
`@theme` in `app/globals.css`; there is no JS config file to edit and creating one does nothing.

**The look is whatever `app/globals.css` defines — read its header.** Keep it unless the owner
asks for colours, a mood or a brand, or your brief says they left the colours to you; then change
the token values (and `identity.accent`), never colours in components. Do not add WishWhip's colours
or mark yourself; if the header names the owner's colours, they chose them: keep them unless they
ask for others. A new `--background`
also goes in `PAGE` (`app/icon-art.tsx`), a phone's launch screen. A tab bar takes
`bottom-bar` (fixed, never `sticky`, which floats mid-screen on a short page); the content under it ends with `pb-bottom-bar`, so the page's last
line (a chart's axis labels, a list's last row) scrolls clear of the bar.

**Every app has a light and a dark scheme, and the tokens switch by themselves.** `:root` holds the
light values and the `prefers-color-scheme: dark` block in `app/globals.css` gives the same tokens
their dark values, so a visitor whose device is set to dark gets a dark app with no code of yours.
Keep it that way: style with tokens (`bg-background`, `bg-card`, `text-foreground`,
`text-muted-foreground`, `border-border`, `bg-primary`), never with fixed colours (`bg-white`,
`text-black`, `bg-slate-50`, a hex in a `style`), which stay light under paper-coloured dark text,
and never with `dark:` variants or a `.dark` class. An accent the app chooses goes in both
schemes: `--primary` for light and `--primary-dark` (the same colour lighter, with dark text) for
dark. A colour drawn in a canvas or a chart reads the token (`getComputedStyle`, `var(--chart-1)`).

**Dependencies.** `npm install <pkg>` works — there is a real shell with network access. Install
what the task genuinely needs rather than reimplementing it, and prefer a package that ships its
own types. A large fixed dataset still belongs in its own module under `lib/`, separate from the
component that renders it.

**No server by default.** An app that needs none may ship as static files, where route handlers
do not run. Adding a route handler of your own, middleware, a server action or an import of
`next/headers` moves it to a server host, so do that only when the goal names the feature that
needs it.

**`npm run lint` is part of your self-check, and one rule fails most runs.**
`react-hooks/set-state-in-effect`: never call a state setter directly in a `useEffect` body. A
value computed from props or state is computed during render (or with `useMemo`); state that should
reset when an id changes is reset with `key={id}`; a value only the browser knows comes from
`useSyncExternalStore`. Setting state inside a callback the effect subscribes to — an event
listener, a timer, a promise's `.then` — is allowed.

**Hydration.** The server renders every client component too, and its HTML must match the first
client render. Never read the current time, `Math.random()`, the visitor's locale or time zone,
`window` or storage during render. Render a placeholder until `useIsHydrated()` from
`@/lib/storage/react` is true, or do the work in an event handler.

**Forms and lists.** An add form opens empty, an edit form with that item's values: key the form
on the open item's id so old values never leak in. Every stored item can be edited and deleted
from every list that shows it, whatever the day or filter. Typed text (names, notes) wraps to two
lines (`line-clamp-2`, full text in `title`), never a one-line `truncate` that hides which it is.

**Charts**: whole, even y ticks from `niceAxis`, at its `width` so no label clips; a reference
line's label where bars cannot cover it (`position: "insideTopLeft"`); a period that cannot have
data yet (tonight) is not counted in a rolling window or average (`recentPeriods`).

**One way to write a time.** Every date and time the app shows comes from one formatter in `lib/`,
built on `Intl.DateTimeFormat` with the device's locale (`undefined`), so 12- or 24-hour follows
the device everywhere: never a hand-built `HH:mm` beside a `toLocaleTimeString()`. A time in
another place (a city's forecast) goes through the same formatter with that place's `timeZone`
and says whose time it is ("in London").

**Per-person settings**, where `app/config.ts` exists. Anyone can open the live app with their own
values for what that file declares, in its link, and use it as their own copy. Read every declared
value with `useAppConfig(appConfig)` in a client component (the starting list with `currentConfig`
in the seed), never typed into the page a second time. Add the settings the plan names there; once
live, never rename or remove a key. A `localStorage` key goes through `copyKey()`. See
`docs/config.md`.

**`params` and `searchParams` are Promises (Next 16).** In a page, layout or `generateMetadata`,
type them as `Promise<{ id: string }>` and `await` them; reading `params.id` directly fails the
build.

## What the finished app must do

When you finish, the supervisor runs `npm install`, `npm test --if-present`, `npm run lint
--if-present` and `npm run build`, then opens the built app in a headless browser **and uses it**.
You cannot run that browser and should not try to imitate it; you pass it by building an app that
meets these requirements:

- **Every route renders visible content and throws nothing** — not on load, and not while it is
  being used. No uncaught exceptions, console errors or failed requests. A page that renders
  nothing fails even when the build passed.
- **Each route renders its own screen, once.** One `<h1>` and at most one `<main>` per page;
  `app/layout.tsx` and `app/providers.tsx` hold only what every page shares (a header, a tab bar),
  never a page's content, and no component renders the home page beside `{children}`. Name your
  own screens' files after the app's words (`components/expense-list.tsx`), never over a file this
  project ships: a page written into a component mounted in `app/providers.tsx` shows under every
  route.
- **The main flow starts from a visible, enabled button with an honest text label** that says what
  it does: "Add expense", "New habit", "Create list". It sits on the page itself, not behind a menu,
  a hover or another step. An icon-only button carries an `aria-label` that says the same.
  Anything tappable is at least 32px tall and wide at phone width, nav links included; the
  ui-kit defaults already are, so only custom controls need a size. A row of choices (tip
  percentages, filters, chips) wraps (`flex flex-wrap gap-2`) and never runs past its card.
- **Entering data uses a real form**: labelled inputs inside a `<form>`, and a submit button named
  for what it does ("Save", "Add"). Submitting it with sensible values visibly adds to the page.
- **Nothing depends on a GPU.** The browser runs headless with no GPU: WebGL 1 and 2 work through
  a software rasteriser (budget a few thousand triangles, not a million) and `navigator.gpu` is
  absent, so nothing may require WebGPU. Anything drawn degrades to something visible rather than a
  blank canvas; if *What this project ships* lists Canvas and 3D, its document has the pattern.
- **Every page renders when opened directly by its URL**, with no sign-in and no prior navigation,
  and the main flow works there. Nothing the product needs exists only behind a dynamic route such
  as `/items/[id]` or a query string.
- **What was added is still there after a reload**, if the app keeps anything at all — the storage
  is already set up (`docs/storage.md`), and nothing is saved until the product's code writes to it.
- **The page title is the app's name from `app/identity.ts`**; the check reads it and a placeholder
  title counts against you. Keep the name and description there true to what the app became. Rewrite
  the description in `app/identity.ts` as what the app is, never the request that asked for it.
- **Each page shows one screen, once.** The check counts every page's `<h1>` and `<main>` and reads
  what sits below the footer: a heading shown twice, a second `<main>`, or a screen drawn under
  another one counts against you.
- **The app follows the device's dark mode.** The check opens the home page in dark mode too: a page
  that stays light, or text that cannot be read on its background there, counts against you. The
  tokens in `app/globals.css` switch by themselves; a fixed colour (`bg-white`, a hex) does not.
- **Every request goes through `lib/query.ts`, and this app makes none**; `fetch` anywhere else
  counts against you.
- **The app opens offline after one visit.** With the network off, the home page renders from what
  is stored. Keep `public/sw.js` and `<HomeScreen />` as shipped; anything that needs the internet
  says so when offline.
- **The check records any read of `navigator.gpu`**, and WebGPU access counts against you unless the
  goal explicitly asks for WebGPU.
- **Destructive actions say so in their label**: Delete, Remove, Clear, Reset, Discard, Sign out,
  Log out, Export, Download, Import, Undo. These are never pressed during the check, so none of them
  can be the only way into what a page does — and a control that hides one behind a harmless label
  is a lie to the person using the app. Import and Export mean moving the app's whole data set in or
  out; a control that loads a file as content — a photo, a document, a JSON file to open — is
  "Choose file", "Add photo" or "Load JSON", is pressed like any other control, and is never
  labelled Import.

`npm run build` passing is not evidence the product works — the untouched starter passes all four
commands. Neither is a page that renders: a tracker whose "Add" button throws renders perfectly.
What is judged is the running application, being used.

## Do not

- **Do not scaffold a new application over this one.** No `create-next-app`, no second `app/`
  directory. Build on what is here.
- **Do not run a dev server.** `next dev` / `npm run dev` are blocked. Use `npm run build` to
  check your work compiles.
- **Do not install Playwright, Puppeteer or Selenium.** Browser automation is blocked; the
  verification step above is how the page gets opened.
- **Do not reimplement something this project already ships.** Every item under "What this project
  ships" is installed, wired up and documented; a second library doing the same job is wasted
  steps and a second source of truth. A shipped component does its whole job, placed inside your
  own card or dialog: where they ship, the camera is `CameraView` and the notifications switch is
  `NotificationsSwitch`. Never rebuild one from its `lib/` helpers: your copy loses the states it
  handles.
- **Do not promise anything the documents above say is impossible.** A screen offering sharing or
  cross-device sync on a device-local database is a screen that lies to the person using it.
  Besides export/import, data reaches another device only through the shipped move panel, where
  `docs/sync.md` exists.
- **Do not delete this file**, any document named above, or `template.capabilities.json`. The
  first two are the briefing for every later task on this repository; the third is how the planner
  knows what this project can do before it writes a single criterion.
- **Do not edit this file, `docs/components.md`, `template.capabilities.json` or
  `app/providers.tsx`.** They are refreshed when a module is added, and an edit is lost. Mount
  something in `app/providers.tsx` only when the supervisor tells you to.
