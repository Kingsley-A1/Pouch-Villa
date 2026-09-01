import type { Metadata } from "next";
import { isIndexable, siteUrl } from "@/lib/seo";
import { readThemePreference } from "@/server/theme";

/**
 * Fonts are self-hosted rather than fetched from Google at build time.
 *
 * `next/font/google` downloads the face during `next build`, which makes every
 * build depend on a third party being reachable — it failed builds here twice.
 * These packages ship the same faces as woff2 inside node_modules, so a build
 * needs no network beyond the package registry, and a visitor's browser makes no
 * request to Google either. Q7 confirmed the client accepts the current
 * typeface, so this is a delivery change, not a design one.
 *
 * The CSS custom properties these expose are declared in globals.css.
 */
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

const title = "Pouch Villa";
const description =
  "Phone pouches, cases and device accessories from Pouch Villa. Browse the range, order online and pay by transfer.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: "%s | Pouch Villa" },
  description,
  alternates: { canonical: "/" },
  robots: isIndexable
    ? { index: true, follow: true, googleBot: { index: true, follow: true } }
    : { index: false, follow: false },
  // The og:image and twitter:image tags, with their type and dimensions, come from
  // src/app/opengraph-image.png and twitter-image.png via the file convention.
  openGraph: {
    type: "website",
    siteName: "Pouch Villa",
    title,
    description,
    url: "/",
    locale: "en_NG",
  },
  twitter: { card: "summary_large_image", title, description },
};

/**
 * The theme choice is stamped onto <html> here, server-side, so the correct
 * palette is in the very first byte of HTML. No inline script, therefore no
 * flash of the wrong theme and nothing that a strict CSP would have to
 * whitelist (§5).
 *
 * "system" writes no attribute at all, which is what lets the
 * `prefers-color-scheme` media query in globals.css decide.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = await readThemePreference();

  return (
    <html lang="en" {...(theme === "system" ? {} : { "data-theme": theme })}>
      <body>{children}</body>
    </html>
  );
}
