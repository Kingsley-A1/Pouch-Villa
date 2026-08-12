import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Namespaced to avoid colliding with Tailwind v4's own --font-sans theme token.
const sans = Inter({ subsets: ["latin"], variable: "--pv-font-sans", display: "swap" });
const display = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--pv-font-display", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Pouch Hub — Best Pouches, Best Prices", template: "%s | Pouch Hub" },
  description: "Prototype digital storefront and sales system for Pouch Hub, Calabar.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
