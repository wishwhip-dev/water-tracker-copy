import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Apostrophes and quotes in JSX text are fine; `>` and `}` are the slips this rule exists for.
      "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }],
    },
  },
  // public/ is served as it is, never bundled: public/sw.js runs in a service worker, whose globals
  // this config does not know, and it must not be "fixed" (docs/home-screen.md).
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/**"]),
]);
