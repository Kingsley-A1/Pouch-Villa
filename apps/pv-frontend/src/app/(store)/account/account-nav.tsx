"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, IdentificationCard, Package, SquaresFour } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Destination = { label: string; description: string; href: string; Glyph: Icon };

const LINKS: readonly Destination[] = [
  {
    label: "Overview",
    description: "Everything at a glance",
    href: "/account",
    Glyph: SquaresFour,
  },
  { label: "Orders", description: "Track and reorder", href: "/account/orders", Glyph: Package },
  { label: "Saved", description: "Your shortlist", href: "/account/saved", Glyph: Heart },
  {
    label: "Your details",
    description: "Name, phone, password",
    href: "/account/details",
    Glyph: IdentificationCard,
  },
];

/**
 * The account's four destinations, as cards.
 *
 * This was a horizontal tab rail that scrolled sideways below `sm`. Two things
 * were wrong with it. A sideways scroll on a phone hides destinations off the
 * right edge with nothing to say they are there, so "Your details" was
 * effectively invisible on a 360 px screen. And a rail of four short words gives
 * no clue what is behind any of them.
 *
 * Cards fix both: every destination is on screen at once, each one is a whole
 * tap target rather than a word, and each says what it holds. The grid is two
 * columns from 360 px because four full-width rows would push the page's actual
 * content below the fold.
 */
export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Your account">
      <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {LINKS.map(({ label, description, href, Glyph }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full min-h-11 flex-col gap-1 rounded-2xl border p-4 transition-colors",
                  active
                    ? "border-(--pv-red) bg-[color-mix(in_srgb,var(--pv-red)_7%,var(--pv-surface))]"
                    : "border-(--pv-line) bg-(--pv-surface) hover:border-[color-mix(in_srgb,var(--pv-red)_45%,var(--pv-line))]",
                )}
              >
                <Glyph
                  size={22}
                  weight={active ? "fill" : "regular"}
                  // Decorative: the link's own text already names the destination,
                  // so an accessible name here would have a screen reader read it twice.
                  aria-hidden="true"
                  className={active ? "text-(--pv-red)" : "text-(--pv-muted)"}
                />
                <span className={cn("mt-1 font-bold", active && "text-(--pv-red)")}>{label}</span>
                <span className="text-xs leading-snug text-(--pv-muted)">{description}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
