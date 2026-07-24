import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Pouch Villa — Prototype Storefront", template: "%s | Pouch Villa" },
  description: "Prototype digital storefront and sales system for Pouch Villa, Calabar.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
