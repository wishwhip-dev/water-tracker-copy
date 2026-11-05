import { ImageResponse } from "next/og";
import { IconArt } from "./icon-art";

// The app's icons, drawn from app/identity.ts by app/icon-art.tsx (which says what they look like).
// One file, four sizes, each served at /icon/<id>: the browser tab's 32px, and the 192px and 512px
// a phone needs before it offers to install the app. "maskable" is the same art without the rounded
// corners, for launchers that crop icons into their own shape; the art already sits inside the
// part they keep.
const ICONS = {
  small: { size: 32, rounded: true },
  pwa: { size: 192, rounded: true },
  "pwa-large": { size: 512, rounded: true },
  maskable: { size: 512, rounded: false },
} as const;

type IconId = keyof typeof ICONS;

export function generateImageMetadata() {
  return (Object.keys(ICONS) as IconId[]).map((id) => ({
    id,
    contentType: "image/png",
    size: { width: ICONS[id].size, height: ICONS[id].size },
  }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const key = String(await id);
  const icon = ICONS[key in ICONS ? (key as IconId) : "small"];
  return new ImageResponse(<IconArt size={icon.size} rounded={icon.rounded} />, { width: icon.size, height: icon.size });
}
