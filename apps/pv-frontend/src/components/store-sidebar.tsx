"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChatCircleDots,
  Heart,
  Package,
  SquaresFour,
  Storefront,
  Truck,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { INFO_LINKS, SHOP_LINKS, isCurrent } from "@/lib/store-nav";
import { cn } from "@/lib/utils";

/**
 * The storefront's desktop navigation.
 *
 * Replaces the horizontal row of links that sat in the header. A row across the
 * top can hold four labels before it starts to crowd the brand and the cart, and
 * the shop already has more than four places worth going — so the supporting
 * pages were reachable on a phone, through the drawer, and on desktop only from
 * the footer at the bottom of a long page.
 *
 * A column has room for all of them at once, keeps the current section visible
 * while someone browses, and leaves the header to do one job: brand, search,
 * cart, account.
 *
 * Desktop only, from `lg`. Below that the drawer already does this better than a
 * squeezed column would, and the two never both render.
 */

const SHOP_ICONS: Record<string, Icon> = {
  "/shop": Storefront,
  "/categories": SquaresFour,
  "/track": Truck,
  "/contact": ChatCircleDots,
};

export function StoreSidebar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-(--pv-line) lg:block">
      {/*
        Sticks below the 76px header and scrolls on its own, so a long product
        list never leaves the navigation stranded above the viewport.
      */}
      <nav
        aria-label="Storefront"
        className="sticky top-[76px] h-[calc(100dvh-76px)] overflow-y-auto px-4 py-7"
      >
        <ul className="grid gap-1">
          {SHOP_LINKS.map(({ label, href }) => {
            const active = isCurrent(pathname, href);
            const Glyph = SHOP_ICONS[href] ?? Storefront;
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
                    active
                      ? "bg-(--pv-cream) text-(--pv-red)"
                      : "text-(--pv-ink) hover:bg-(--pv-wash)",
                  )}
                >
                  {/* Decorative: the link's own text already names the destination. */}
                  <Glyph aria-hidden="true" size={20} weight={active ? "fill" : "regular"} />
                  {label}
                </Link>
              </li>
            );
          })}

          <li>
            <Link
              href="/account/saved"
              aria-current={isCurrent(pathname, "/account/saved") ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
                isCurrent(pathname, "/account/saved")
                  ? "bg-(--pv-cream) text-(--pv-red)"
                  : "text-(--pv-ink) hover:bg-(--pv-wash)",
              )}
            >
              <Heart
                aria-hidden="true"
                size={20}
                weight={isCurrent(pathname, "/account/saved") ? "fill" : "regular"}
              />
              Saved
            </Link>
          </li>

          <li>
            <Link
              href="/account"
              aria-current={pathname === "/account" ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
                pathname === "/account"
                  ? "bg-(--pv-cream) text-(--pv-red)"
                  : "text-(--pv-ink) hover:bg-(--pv-wash)",
              )}
            >
              <Package
                aria-hidden="true"
                size={20}
                weight={pathname === "/account" ? "fill" : "regular"}
              />
              {signedIn ? "Your account" : "Sign in"}
            </Link>
          </li>
        </ul>

        <p
          id="store-sidebar-info"
          className="mt-7 border-t border-(--pv-line) px-3 pt-6 pb-1 text-xs font-bold tracking-[.14em] text-(--pv-muted) uppercase"
        >
          Information
        </p>
        <ul aria-labelledby="store-sidebar-info" className="grid gap-0.5">
          {INFO_LINKS.map(({ label, href }) => {
            const active = isCurrent(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
                    active ? "text-(--pv-red)" : "text-(--pv-muted) hover:bg-(--pv-wash)",
                  )}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
