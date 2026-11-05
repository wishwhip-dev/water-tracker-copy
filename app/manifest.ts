import type { MetadataRoute } from "next";
import { barColour, PAGE } from "./icon-art";
import { homeScreenName, identity } from "./identity";

// What a phone uses when the app is added to its home screen. Drawn from app/identity.ts; the
// colours are the page's (app/icon-art.tsx), or the owner's once `accent` is theirs. `PAGE` is the
// launch screen's colour and must equal `--background` in app/globals.css. public/sw.js and
// <HomeScreen /> (docs/home-screen.md) rely on `id`, `start_url`, `scope` and `display` as they are.
// Static export (WISHWHIP_STATIC=1) needs this to prerender the file; harmless on a server build.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: identity.name,
    short_name: homeScreenName,
    description: identity.description,
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: PAGE,
    theme_color: barColour,
    // Opening the app again focuses the window already open (Chromium; ignored elsewhere).
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
    // Served by app/icon.tsx. 192px and 512px are what a phone needs before it offers to install.
    icons: [
      { src: "/icon/pwa", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/pwa-large", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
