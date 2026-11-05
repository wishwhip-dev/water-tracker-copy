import { identity } from "./identity";

// The drawing behind app/icon.tsx, app/apple-icon.tsx and app/opengraph-image/route.tsx, and the colours
// the manifest and the browser bar use. Not a route: Next serves nothing from this file.
//
// Until the owner picks a colour, the icon is the app's initial in ink on a paper tile with a thin
// edge, and a small maker's stamp under the letter: the one-colour WishWhip mark, 18% of the tile
// wide, in a soft grey. The stamp is left off at 64px and below, where it would be a smudge, and
// whenever the owner's plan hides "Made with WishWhip" in the footer (`badgeHidden`). When
// `accent` in app/identity.ts is anything but the ink it starts as, the tile takes that colour and
// the letter and the stamp turn paper (or ink, on a colour pale enough that ink reads better). When
// the owner gives the app an icon of their own, replace these files with it; nothing of this stays.
//
// The letter is set in the one sans-serif face `ImageResponse` ships with (it cannot reach the
// system's fonts and fetches none), thickened with a stroke of its own colour to read as bold.

/** The value `accent` starts as: no colour chosen yet. */
export const DEFAULT_ACCENT = "#1c1915";

/** From the theme in app/globals.css (`--background`, `--foreground`, `--muted-foreground`). */
export const PAGE = "#faf7f2";
export const TEXT = "#1c1915";
export const MUTED_TEXT = "#5d5751";

const PAPER_TILE = "#faf7f2";
const HAIRLINE = "#e8e2da";
const INK = "#1c1915";
const PAPER = "#fefcf9";
const STAMP_GREY = "#5d5751";

// Set by WishWhip at deploy, from the owner's plan, and read at build time as the footer reads it
// (components/attribution.tsx): "hidden" drops "Made with WishWhip" there, and the stamp here.
export const badgeHidden = process.env.NEXT_PUBLIC_WISHWHIP_BADGE === "hidden";

/** The owner's colour, or null while `accent` is still the default. */
export const ownColour = identity.accent.toLowerCase() === DEFAULT_ACCENT ? null : identity.accent;

/** The browser bar and the manifest's theme colour: the owner's colour, else the page's. */
export const barColour = ownColour ?? PAGE;

/** The page's colour in the dark scheme (`--background` in app/globals.css's dark block). */
export const PAGE_DARK = "#120f0c";

/** The browser bar per scheme (the layout's `themeColor`): the owner's colour in both, else the page's in each. */
export const barColours: { color: string; media?: string }[] = ownColour
  ? [{ color: ownColour }]
  : [{ media: "(prefers-color-scheme: light)", color: PAGE }, { media: "(prefers-color-scheme: dark)", color: PAGE_DARK }];

/**
 * A short hash of everything the share image draws (app/opengraph-image/route.tsx): the identity, the
 * page's colours, the address and whether "Made with WishWhip" shows. The layout puts it in the
 * image's address. Next's file-convention address hashed only the source, so a rename kept the old
 * address and link previews kept showing the old name; this one changes with what the card shows.
 */
export const cardVersion = versionOf([
  identity.name, identity.description, identity.accent, identity.initial, PAGE, TEXT, MUTED_TEXT,
  process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "", process.env.NEXT_PUBLIC_WISHWHIP_URL ?? "", String(badgeHidden),
]);

/** FNV-1a over the parts, in base 36: stable, short, no dependency. */
export function versionOf(parts: readonly string[]): string {
  const text = parts.join("\n");
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  return (hash >>> 0).toString(36);
}

function luminance(hex: string): number {
  const value = Number.parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 0xff) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** Paper on the owner's colour, or ink when the colour is pale enough that ink reads better. */
function letterOn(colour: string): string {
  return contrast(PAPER, colour) >= contrast(INK, colour) ? PAPER : INK;
}

// The WishWhip mark in one colour: the small drawing below 48px wide, the large one above. `box` is
// each drawing's ink, round caps included, so the stamp is sized by what shows.
const MARKS = {
  large: {
    box: "43.15 107 426.75 295.65",
    ratio: 295.65 / 426.75,
    stroke: 39.3,
    w: "M62.8 148.4L124.9 383L200.8 217.4L276.7 383",
    flick: "M276.7 383C297.4 314 318.1 258.8 352.6 224.3",
    spark: "M414.7 107Q429.9 147 469.9 162.2Q429.9 177.3 414.7 217.4Q399.5 177.3 359.5 162.2Q399.5 147 414.7 107Z",
  },
  small: {
    box: "0.4 4 31.2 22.6",
    ratio: 22.6 / 31.2,
    stroke: 3.6,
    w: "M2.2 8.8L6.4 24.8L11.6 13.5L16.8 24.8",
    flick: "M16.8 24.8C18.2 20.1 19.6 16.3 21.9 14",
    spark: "M27.1 4Q28.7 6.9 31.6 8.5Q28.7 10.1 27.1 13.1Q25.5 10.1 22.6 8.5Q25.5 6.9 27.1 4Z",
  },
} as const;

function Stamp({ width, colour }: { width: number; colour: string }) {
  const mark = width < 48 ? MARKS.small : MARKS.large;
  const height = Math.round(width * mark.ratio);
  return (
    <svg width={width} height={height} viewBox={mark.box} style={{ overflow: "visible" }}>
      <path d={mark.w} fill="none" stroke={colour} strokeWidth={mark.stroke} strokeLinecap="round" strokeLinejoin="round" />
      <path d={mark.flick} fill="none" stroke={colour} strokeWidth={mark.stroke} strokeLinecap="round" />
      <path d={mark.spark} fill={colour} />
    </svg>
  );
}

/**
 * The icon, `size` px square. `rounded` draws the tile's corners and its edge (a browser tab, an
 * Android launcher); leave it off where the platform shapes the icon itself (iOS, maskable).
 * Everything sits inside the middle 80% circle, the part no launcher crops.
 */
export function IconArt({ size, rounded }: { size: number; rounded: boolean }) {
  const stamped = size > 64 && !badgeHidden;
  const letter = ownColour ? letterOn(ownColour) : INK;
  const fontSize = Math.round(size * (stamped ? 0.5 : 0.7));
  const edge = !ownColour && rounded ? Math.max(1, Math.round(size / 160)) : 0;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: Math.round(size * 0.035),
        background: ownColour ?? PAPER_TILE,
        borderRadius: rounded ? Math.round(size * 0.22) : 0,
        border: edge ? `${edge}px solid ${HAIRLINE}` : "none",
        color: letter,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize,
          fontWeight: 700,
          lineHeight: 1,
          // A stroke of the letter's own colour thickens the one regular face toward bold.
          WebkitTextStroke: `${Math.max(0.5, fontSize * 0.035)}px ${letter}`,
          // The line box is taller than the capital; this centres the capital, not the box.
          marginTop: -Math.round(size * (stamped ? 0.015 : 0.04)),
        }}
      >
        {identity.initial}
      </div>
      {stamped ? <Stamp width={Math.round(size * 0.18)} colour={ownColour ? letter : STAMP_GREY} /> : null}
    </div>
  );
}
