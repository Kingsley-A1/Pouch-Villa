"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  ["Overview", "/account"],
  ["Orders", "/account/orders"],
  ["Saved", "/account/saved"],
  ["Your details", "/account/details"],
] as const;

/**
 * Scrolls sideways below `sm` rather than wrapping onto three lines or
 * collapsing into a select. Four short labels fit a 360 px screen with room to
 * spare, and a horizontal rail keeps every destination one tap away.
 */
export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Your account" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-(--pv-line)">
        {LINKS.map(([label, href]) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center border-b-2 px-4 text-sm font-bold whitespace-nowrap",
                  active
                    ? "border-(--pv-red) text-(--pv-red)"
                    : "border-transparent text-(--pv-muted) hover:text-(--pv-ink)",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
