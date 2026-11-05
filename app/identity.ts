/**
 * What this app is called and how it looks when shared: the page title, the description search
 * engines and link previews show, the colour of the icon and the browser bar, and the letter on
 * the icon. The layout, the icons, the manifest and the share image all read from here, so a
 * change here reaches every one of them. Keep `name` short and `description` one plain sentence.
 * `accent` starts as ink, #1c1915, which means no colour chosen: the icon is then the letter on
 * paper (app/icon-art.tsx). Set it, as `#rrggbb` and equal to `--primary` in app/globals.css, when
 * the owner asks for a colour or has left the app's colour to you; keep a colour already set here.
 */
export const identity = {
  name: "Water tracker copy",
  description: "Tap to log each glass of water, watch today's total fill against your daily goal, and see the last two weeks at a glance.",
  accent: "#1d6fa3",
  initial: "W",
} as const;

/**
 * The label under the icon on a phone's home screen: the whole name when it fits in 12
 * characters, else its first word, cut to 12. It follows `name`, so change the name, not this.
 */
export const homeScreenName = Array.from(identity.name).length <= 12
  ? identity.name
  : Array.from(identity.name.split(" ")[0]).slice(0, 12).join("");
