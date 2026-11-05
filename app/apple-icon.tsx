import { ImageResponse } from "next/og";
import { IconArt } from "./icon-art";

// The home-screen icon on iPhone and iPad, drawn from app/identity.ts by app/icon-art.tsx. Square
// and full-bleed: iOS rounds the corners itself, and transparent corners would show as black there.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
// Static export (WISHWHIP_STATIC=1) needs this to prerender the file; harmless on a server build.
export const dynamic = "force-static";

export default function AppleIcon() {
  return new ImageResponse(<IconArt size={size.width} rounded={false} />, size);
}
