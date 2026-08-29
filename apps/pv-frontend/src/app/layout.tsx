import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { isIndexable, siteUrl } from "@/lib/seo";
import "./globals.css";

// Namespaced to avoid colliding with Tailwind v4's own --font-sans theme token.
const sans = Inter({ subsets: ["latin"], variable: "--pv-font-sans", display: "swap" });
const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--pv-font-display",
  display: "swap",
});

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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
