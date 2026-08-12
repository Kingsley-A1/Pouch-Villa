import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Namespaced to avoid colliding with Tailwind v4's own --font-sans theme token.
const sans = Inter({ subsets: ["latin"], variable: "--pv-font-sans", display: "swap" });
const display = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--pv-font-display", display: "swap" });

const title = "Pouch Hub — Protect your phone, show your style";
const description = "Varieties of Phone cases matched to your exact model, best prices. Browse, save and reserve for collection in Calabar.";

// Link previews need absolute URLs. Vercel exposes the stable production domain at
// runtime, so the right host is used without hardcoding it; the per-deployment URL
// covers preview builds, and localhost keeps local builds working.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
  "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: "%s | Pouch Hub" },
  description,
  robots: { index: false, follow: false },
  // The og:image and twitter:image tags, with their type and dimensions, come from
  // src/app/opengraph-image.png and twitter-image.png via the file convention.
  openGraph: { type: "website", siteName: "Pouch Hub", title, description, url: "/", locale: "en_NG" },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
