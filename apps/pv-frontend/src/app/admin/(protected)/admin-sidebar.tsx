"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChatCircleDots,
  CreditCard,
  DeviceMobile,
  GearSix,
  IdentificationCard,
  MapPin,
  Package,
  Receipt,
  ShieldCheck,
  SidebarSimple,
  SquaresFour,
  Star,
  Tag,
  Users,
} from "@phosphor-icons/react";
import type { NavSection } from "./nav-sections";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "pv-admin-sidebar-open";
const listeners = new Set<() => void>();

const SECTION_ICONS: Record<string, typeof SquaresFour> = {
  "/admin": SquaresFour,
  "/admin/products": Package,
  "/admin/categories": Tag,
  "/admin/devices": DeviceMobile,
  "/admin/delivery": MapPin,
  "/admin/orders": Receipt,
  "/admin/payments": CreditCard,
  "/admin/customers": Users,
  "/admin/reviews": Star,
  "/admin/contact": ChatCircleDots,
  "/admin/staff": IdentificationCard,
  "/admin/roles": ShieldCheck,
  "/admin/settings": GearSix,
};

function subscribeToPreference(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function readPreference() {
  try {
    // Anything but an explicit "false" means open, so a first visit and a
    // browser blocking storage both land on the expanded default.
    return window.localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function writePreference(open: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(open));
  } catch {
    // The preference simply will not persist; the toggle still works.
  }
  for (const listener of listeners) listener();
}

/**
 * The desktop sidebar keeps navigation reachable as either a labelled panel or
 * a conventional icon rail. Its browser-local preference changes presentation,
 * never permissions; the server still supplies only authorised sections.
 */
export function AdminSidebar({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const open = useSyncExternalStore(subscribeToPreference, readPreference, () => true);
  const toggle = useCallback(() => writePreference(!open), [open]);

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r border-(--pv-line) bg-white lg:block",
        "transition-[width] duration-175 ease-out motion-reduce:transition-none",
        open ? "w-60" : "w-[4.5rem]",
      )}
    >
      <nav
        aria-label="Admin sections"
        className="sticky top-16 h-[calc(100dvh-4rem)] overflow-y-auto p-3"
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
          className={cn(
            "mb-3 flex min-h-11 w-full items-center gap-3 rounded-xl text-sm font-semibold text-(--pv-muted)",
            "hover:bg-(--pv-wash) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
            open ? "px-3" : "justify-center px-0",
          )}
        >
          <SidebarSimple aria-hidden="true" size={21} weight="bold" />
          <span
            aria-hidden="true"
            className={cn(
              "whitespace-nowrap transition-opacity duration-150 motion-reduce:transition-none",
              open ? "opacity-100" : "w-0 overflow-hidden opacity-0",
            )}
          >
            Collapse
          </span>
        </button>

        <ul className="grid gap-1">
          {sections.map((section) => {
            const active =
              section.href === "/admin" ? pathname === "/admin" : pathname.startsWith(section.href);
            const Icon = SECTION_ICONS[section.href] ?? SquaresFour;

            return (
              <li key={section.href}>
                <Link
                  href={section.href}
                  aria-label={section.label}
                  aria-current={active ? "page" : undefined}
                  title={open ? undefined : section.label}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-xl text-sm font-semibold",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
                    open ? "px-3" : "justify-center px-0",
                    active
                      ? "bg-(--pv-cream) text-(--pv-red)"
                      : "text-(--pv-ink) hover:bg-(--pv-wash)",
                  )}
                >
                  <Icon aria-hidden="true" size={21} weight={active ? "fill" : "regular"} />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "whitespace-nowrap transition-opacity duration-150 motion-reduce:transition-none",
                      open ? "opacity-100" : "w-0 overflow-hidden opacity-0",
                    )}
                  >
                    {section.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
