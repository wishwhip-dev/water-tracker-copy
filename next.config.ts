import type { NextConfig } from "next";

// The supervisor sets WISHWHIP_STATIC=1 for apps that need no server, and publishes `out/` as plain
// files (docs/plans/static-hosting.md §3–4). Unset, the app builds as a server app: on our Worker
// host (WISHWHIP_WORKER=1, docs/plans/cloudflare-apps-platform.md S9) or anywhere else.
const isStatic = process.env.WISHWHIP_STATIC === "1";

// Images are never optimised on the fly: a static export cannot, and our Worker host does not.
const images = { unoptimized: true };

// A safe baseline on every page and file: framed by this site only, no type sniffing, HTTPS
// remembered, and a referrer that leaves out paths on other sites. Nothing an app loads or runs is
// restricted. A static export cannot send headers (the static host adds the same set itself), so
// they are left out of that build.
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = isStatic
  ? { output: "export", images }
  : {
      images,
      async headers() {
        return [{ source: "/:path*", headers: securityHeaders }];
      },
    };

export default nextConfig;
