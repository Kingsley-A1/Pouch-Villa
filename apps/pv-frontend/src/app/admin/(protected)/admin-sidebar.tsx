"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSection } from "./nav-sections";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "pv-admin-sidebar-open";

/**
 * The open/closed preference lives in localStorage, read through an external
 * store rather than copied into state by an effect. An effect that setStates on
 * mount costs an extra render of the whole nav on every admin page load, and
 * React now flags it; `useSyncExternalStore` is the primitive built for reading
 * a value that lives outside React and differs between server and client.
 */
const listeners = new Set<() => void>();

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
 * The desktop admin sidebar, collapsible.
 *
 * Collapsed it keeps a rail of initials rather than disappearing, so the nav
 * never becomes unreachable and the main content still has a landmark beside
 * it. The choice persists per browser — someone who works collapsed should not
 * have to re-collapse on every page.
 */
export function AdminSidebar({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  // Expanded on the server: it is the default, and it is what most sessions
  // render, so hydration settles on the common case without a visible jump.
  const open = useSyncExternalStore(subscribeToPreference, readPreference, () => true);

  const toggle = useCallback(() => writePreference(!open), [open]);

  return (
    <nav
      aria-label="Admin sections"
      className={cn(
        "hidden shrink-0 lg:block",
        // Width is the only thing that animates, so the main column reflows
        // smoothly instead of snapping.
        "transition-[width] duration-200 motion-reduce:transition-none",
        open ? "w-56" : "w-14",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="mb-2 flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold text-(--pv-muted) hover:bg-white"
      >
        <span aria-hidden="true" className="text-base leading-none">
          {open ? "«" : "»"}
        </span>
        {open ? <span>Collapse</span> : null}
        <span className="sr-only">{open ? "Collapse sidebar" : "Expand sidebar"}</span>
      </button>

      <ul className="grid gap-1">
        {sections.map((section) => {
          // `/admin` is a prefix of every other route, so it only counts as
          // active on an exact match — otherwise Dashboard highlights forever.
          const active =
            section.href === "/admin" ? pathname === "/admin" : pathname.startsWith(section.href);
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                title={open ? undefined : section.label}
                className={cn(
                  "flex min-h-11 items-center rounded-xl text-sm font-semibold",
                  open ? "px-3" : "justify-center px-0",
                  active ? "bg-white text-(--pv-red)" : "text-(--pv-ink) hover:bg-white",
                )}
              >
                {open ? (
                  section.label
                ) : (
                  <>
                    <span aria-hidden="true">{section.label.charAt(0)}</span>
                    <span className="sr-only">{section.label}</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
