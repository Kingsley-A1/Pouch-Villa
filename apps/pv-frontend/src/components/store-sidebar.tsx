"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CaretDown,
  ChatCircleDots,
  Heart,
  Info,
  List,
  Package,
  SidebarSimple,
  SquaresFour,
  Storefront,
  Truck,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { BrandLink } from "@pv/backend/services/catalogue";
import { INFO_LINKS, SHOP_LINKS, isCurrent } from "@/lib/store-nav";
import { cn } from "@/lib/utils";

/**
 * The storefront's desktop navigation.
 *
 * **Collapsed by default.** It opened expanded at first, which put a 240px
 * column of navigation between the viewport edge and the products on every
 * page — the shop paying rent for links most visitors do not need on the way to
 * a purchase. As an icon rail it stays one click from anywhere without taking
 * the room a product row could use, and the preference is remembered per
 * browser once someone opens it.
 *
 * The same browser-local, presentation-only preference pattern as the admin
 * sidebar. It changes width, never what is in it.
 *
 * Desktop only, from `lg`. Below that the drawer does this better than a
 * squeezed column would, and the two never both render.
 */

const STORAGE_KEY = "pv-store-sidebar-open";
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
    // Anything but an explicit "true" means collapsed, so a first visit and a
    // browser blocking storage both land on the narrow default.
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
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

type Destination = { label: string; href: string; Glyph: Icon };

const SHOP_ICONS: Record<string, Icon> = {
  "/shop": Storefront,
  "/categories": SquaresFour,
  "/track": Truck,
  "/contact": ChatCircleDots,
};

export function StoreSidebar({ signedIn, brands }: { signedIn: boolean; brands: BrandLink[] }) {
  const pathname = usePathname();
  // The server render and the first client render must agree, so this starts
  // collapsed and widens only once the stored preference has been read.
  const open = useSyncExternalStore(subscribeToPreference, readPreference, () => false);
  const toggle = useCallback(() => writePreference(!open), [open]);

  const shop: Destination[] = SHOP_LINKS.map(({ label, href }) => ({
    label,
    href,
    Glyph: SHOP_ICONS[href] ?? Storefront,
  }));

  const account: Destination[] = [
    { label: "Saved", href: "/account/saved", Glyph: Heart },
    { label: signedIn ? "Your account" : "Sign in", href: "/account", Glyph: Package },
  ];

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r border-(--pv-line) lg:block",
        "transition-[width] duration-175 ease-out motion-reduce:transition-none",
        open ? "w-60" : "w-[4.5rem]",
      )}
    >
      {/*
        Sticks below the 76px header and scrolls on its own, so a long product
        list never leaves the navigation stranded above the viewport.
      */}
      <nav
        aria-label="Storefront"
        className="sticky top-19 h-[calc(100dvh-76px)] overflow-y-auto p-3"
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? "Collapse navigation" : "Expand navigation"}
          className={cn(
            "mb-2 flex min-h-11 w-full items-center gap-3 rounded-xl text-sm font-semibold text-(--pv-muted)",
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

        <BrandMenu brands={brands} open={open} />

        <SidebarLinks items={shop} pathname={pathname} open={open} />

        <div className="my-2 border-t border-(--pv-line)" />
        <SidebarLinks items={account} pathname={pathname} open={open} />

        <div className="my-2 border-t border-(--pv-line)" />
        {/*
          The supporting pages. Quieter than the links that lead to a sale, and
          collapsed to a single icon on the rail — four separate icons for
          Privacy, Terms, About and Returns would give them more weight than
          the shop itself, which is the opposite of what they are for.
        */}
        {open ? (
          <>
            <p
              id="store-sidebar-info"
              className="px-3 pt-3 pb-1 text-xs font-bold tracking-[.14em] text-(--pv-muted) uppercase"
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
          </>
        ) : (
          <Link
            href="/about"
            aria-label="About us, returns, privacy and terms"
            title="Information"
            className={cn(
              "flex min-h-11 items-center justify-center rounded-xl text-(--pv-muted)",
              "hover:bg-(--pv-wash) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
            )}
          >
            <Info aria-hidden="true" size={21} />
          </Link>
        )}
      </nav>
    </aside>
  );
}

/**
 * The makes the shop carries, on a hamburger.
 *
 * The client asked for the reference site's "Browse categories" control, filled
 * with brands rather than categories. It opens on hover **and** on focus, and it
 * is a real `<button>` with `aria-expanded`: a hover-only menu is unreachable by
 * keyboard and invisible to a touch screen, which is most of this shop.
 *
 * The names come from the same `brand` rows the admin's Brands & Categories
 * screen manages — there is no second list to keep in step — and only makes with
 * something published appear, so no entry here leads to an empty shelf.
 *
 * It renders nothing at all where the shop has no brands yet, rather than
 * offering a control that opens onto nothing.
 */
function BrandMenu({ brands, open }: { brands: BrandLink[]; open: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = "store-sidebar-brands";

  if (brands.length === 0) return null;

  return (
    // Hover opens it; focus-within keeps it open while tabbing through the
    // links inside, which is what stops it closing under a keyboard user.
    <div
      className="relative mb-1"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExpanded(false);
      }}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        // Tapping is the touch equivalent of hovering, and without it this
        // control does nothing at all on a tablet.
        onClick={() => setExpanded((wasOpen) => !wasOpen)}
        className={cn(
          "flex min-h-11 w-full items-center gap-3 rounded-xl text-sm font-bold",
          "bg-(--pv-surface-raised) text-(--pv-ink)",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-focus)",
          open ? "px-3" : "justify-center px-0",
        )}
      >
        <List aria-hidden="true" size={20} weight="bold" />
        <span
          className={cn(
            "flex flex-1 items-center justify-between gap-2 whitespace-nowrap",
            open ? "opacity-100" : "w-0 overflow-hidden opacity-0",
          )}
        >
          {/* Not `aria-hidden` like the other collapsed labels: this one names
              the control, and the button has no other accessible text. */}
          <span>Shop by brand</span>
          <CaretDown aria-hidden="true" size={14} weight="bold" />
        </span>
        {open ? null : <span className="sr-only">Shop by brand</span>}
      </button>

      {expanded ? (
        <ul
          id={panelId}
          className={cn(
            "absolute z-30 max-h-72 overflow-y-auto py-1",
            "border border-(--pv-line) bg-(--pv-surface) shadow-[0_14px_40px_-18px_var(--pv-shadow)]",
            // Beneath the button when the rail is open, beside it when it is a
            // narrow rail — where a dropdown would be wider than the sidebar.
            open ? "top-full left-0 w-full" : "top-0 left-full ml-1 w-52",
          )}
        >
          {brands.map((brand) => (
            <li key={brand.id}>
              <Link
                href={`/shop?brand=${brand.slug}`}
                className={cn(
                  "flex min-h-11 items-center px-3 text-sm font-semibold uppercase",
                  "text-(--pv-ink) hover:bg-(--pv-wash)",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--pv-focus)",
                )}
              >
                {brand.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SidebarLinks({
  items,
  pathname,
  open,
}: {
  items: Destination[];
  pathname: string;
  open: boolean;
}) {
  return (
    <ul className="grid gap-1">
      {items.map(({ label, href, Glyph }) => {
        const active = isCurrent(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              // The accessible name lives here so it survives the collapsed
              // rail clipping the visible label.
              aria-label={label}
              aria-current={active ? "page" : undefined}
              title={open ? undefined : label}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl text-sm font-bold",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
                open ? "px-3" : "justify-center px-0",
                active ? "bg-(--pv-cream) text-(--pv-red)" : "text-(--pv-ink) hover:bg-(--pv-wash)",
              )}
            >
              <Glyph aria-hidden="true" size={20} weight={active ? "fill" : "regular"} />
              <span
                aria-hidden="true"
                className={cn(
                  "whitespace-nowrap transition-opacity duration-150 motion-reduce:transition-none",
                  open ? "opacity-100" : "w-0 overflow-hidden opacity-0",
                )}
              >
                {label}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
