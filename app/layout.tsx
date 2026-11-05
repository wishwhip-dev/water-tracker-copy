import type { Metadata, Viewport } from "next";
import { Attribution } from "@/components/attribution";
import "./globals.css";
import { barColours, cardVersion } from "./icon-art";
import { homeScreenName, identity } from "./identity";
import { Providers } from "./providers";

// The deployed address, so link previews get an absolute URL for the share image. Vercel sets it
// at build time; elsewhere Next falls back to localhost, which is fine for local work.
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

// The share image at an address that changes with what it draws (`cardVersion`, app/icon-art.tsx),
// so a rename reaches link previews. The picture is a route handler (app/opengraph-image/route.tsx),
// not Next's file convention, so this is the page's only og:image and twitter:image.
const shareImage = { url: `/opengraph-image?v=${cardVersion}`, alt: identity.name, type: "image/png", width: 1200, height: 630 };

// The name, description and colour come from app/identity.ts. Change them there, not here.
export const metadata: Metadata = {
  metadataBase: productionHost ? new URL(`https://${productionHost}`) : undefined,
  title: { default: identity.name, template: `%s · ${identity.name}` },
  description: identity.description,
  applicationName: identity.name,
  openGraph: { title: identity.name, description: identity.description, siteName: identity.name, type: "website", images: [shareImage] },
  twitter: { card: "summary_large_image", images: [shareImage] },
  // Opened from a phone's home screen: full screen, labelled `homeScreenName`, with a light status
  // bar to match the page (never "black-translucent", which draws the page under the bar). Next 16
  // writes only mobile-web-app-capable, so older iPhones get the apple- tag through `other`.
  appleWebApp: { capable: true, title: homeScreenName, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  // The page's colour in each scheme, or the owner's colour in both (app/icon-art.tsx).
  themeColor: barColours,
  width: "device-width",
  initialScale: 1,
  // The page reaches the screen's edges; app/globals.css keeps content clear of the notch.
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><Providers>{children}<Attribution /></Providers></body>
    </html>
  );
}
