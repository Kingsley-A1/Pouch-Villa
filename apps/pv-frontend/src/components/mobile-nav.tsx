"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretRight, List, User, X } from "@phosphor-icons/react";
import type { BrandLink } from "@pv/backend/services/catalogue";
import { INFO_LINKS, SHOP_LINKS } from "@/lib/store-nav";

/**
 * The signed-in customer, or `null` for a visitor. Resolved on the server so the
 * drawer never has to fetch a session itself.
 */
export type DrawerAccount = { name: string | null; monogram: string | null; email: string };

/**
 * Reads the navigation from `lib/store-nav` rather than taking it as props. The
 * desktop sidebar reads the same list, so the two cannot drift — which they had,
 * back when the header owned one copy and the drawer another.
 */
export function MobileNav({
  account,
  brands,
}: {
  account: DrawerAccount | null;
  brands: BrandLink[];
}) {
  const pathname = usePathname();
  // The header sets backdrop-filter, which makes it the containing block for any
  // fixed-position descendant. Rendered inline, the overlay was therefore sized to
  // the 76px header instead of the viewport, so only its top row was visible. The
  // portal moves it to <body>, escaping that containing block. No mount guard is
  // needed: the panel only opens from a click, so it never renders during SSR.
  // Remember which route the panel was opened on. The panel counts as open only
  // while that still matches the current route, so navigating anywhere closes it
  // automatically — no effect and no cascading render needed.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn !== null && openedOn === pathname;
  const close = () => setOpenedOn(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenedOn(null);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpenedOn(pathname)}
        className="grid h-11 w-11 place-items-center rounded-xl hover:bg-(--pv-wash)"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <List size={25} />
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-60 lg:hidden">
              <button
                type="button"
                aria-label="Close menu"
                onClick={close}
                className="absolute inset-0 h-full w-full cursor-default bg-black/40"
              />
              <nav
                aria-label="Mobile navigation"
                className="absolute top-0 right-0 flex h-full w-[min(84vw,340px)] flex-col bg-(--pv-surface) shadow-2xl"
              >
                <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-(--pv-line) px-5">
                  <span className="text-sm font-bold tracking-wide text-(--pv-muted)">Menu</span>
                  <button
                    type="button"
                    onClick={close}
                    className="grid h-11 w-11 place-items-center rounded-xl hover:bg-(--pv-wash)"
                    aria-label="Close menu"
                  >
                    <X size={23} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  {/*
                    The account, at the top and named.
                    
                    Below `lg` the header no longer shows a user icon for someone
                    who is signed in, so this is where the account lives. A row
                    with their initials and first name on it also answers the
                    question a shared phone raises — whose session is this —
                    which an anonymous icon in a header never could.
                  */}
                  {account !== null ? (
                    <Link
                      href="/account"
                      onClick={close}
                      aria-current={pathname.startsWith("/account") ? "page" : undefined}
                      className={`mb-2 flex items-center gap-3 rounded-2xl border p-3 ${
                        pathname.startsWith("/account")
                          ? "border-(--pv-red) bg-[color-mix(in_srgb,var(--pv-red)_7%,var(--pv-surface))]"
                          : "border-(--pv-line) hover:bg-(--pv-wash)"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-(--pv-red) font-extrabold text-(--pv-on-brand)"
                      >
                        {account.monogram ?? <User size={20} weight="fill" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">
                          {account.name === null ? "Your account" : `Hi, ${account.name}`}
                        </span>
                        <span className="block truncate text-xs text-(--pv-muted)">
                          {account.email}
                        </span>
                      </span>
                      <CaretRight size={16} aria-hidden="true" className="shrink-0" />
                    </Link>
                  ) : null}

                  {SHOP_LINKS.map(({ label, href }) => {
                    const active = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        // Tapping the current page does not change the route, so close explicitly.
                        onClick={close}
                        aria-current={active ? "page" : undefined}
                        className={`block truncate rounded-xl px-4 py-3.5 font-bold ${active ? "bg-(--pv-wash) text-(--pv-red)" : "hover:bg-(--pv-wash)"}`}
                      >
                        {label}
                      </Link>
                    );
                  })}

                  {/*
                    The makes, in the drawer as well as on the desktop rail.

                    A phone has no hover, so there is nothing to reveal on: the
                    list is simply here, under the shop links, where somebody
                    looking for their phone's brand would look. It reads the same
                    rows the sidebar does, so the two can never disagree.
                  */}
                  {brands.length > 0 ? (
                    <>
                      <p
                        id="drawer-brands"
                        className="px-4 pt-4 pb-1 text-xs font-bold tracking-[.14em] text-(--pv-muted) uppercase"
                      >
                        Shop by brand
                      </p>
                      {brands.map((brand) => (
                        <Link
                          key={brand.id}
                          href={`/shop?brand=${brand.slug}`}
                          onClick={close}
                          className="block truncate rounded-xl px-4 py-3 font-semibold uppercase hover:bg-(--pv-wash)"
                        >
                          {brand.name}
                        </Link>
                      ))}
                    </>
                  ) : null}

                  {/*
                    Sits with the shopping links rather than under Information:
                    signing in is a thing you do, not a page you read. Someone
                    already signed in has the card above instead.
                  */}
                  {account === null ? (
                    <Link
                      href="/account"
                      onClick={close}
                      aria-current={pathname.startsWith("/account") ? "page" : undefined}
                      className={`block truncate rounded-xl px-4 py-3.5 font-bold ${
                        pathname.startsWith("/account")
                          ? "bg-(--pv-wash) text-(--pv-red)"
                          : "hover:bg-(--pv-wash)"
                      }`}
                    >
                      Sign in
                    </Link>
                  ) : null}

                  {/*
                    A separate, quieter group. The supporting pages belong in the
                    drawer — on a phone the footer is a long scroll away — but
                    they must not compete visually with the links that lead to a
                    sale, so they are lighter and set apart rather than appended
                    to the list above.
                  */}
                  <p
                    id="mobile-nav-info"
                    className="mt-4 border-t border-(--pv-line) px-4 pt-5 pb-1 text-xs font-bold tracking-[.14em] text-(--pv-muted) uppercase"
                  >
                    Information
                  </p>
                  <ul aria-labelledby="mobile-nav-info">
                    {INFO_LINKS.map(({ label, href }) => {
                      const active = pathname === href;
                      return (
                        <li key={href}>
                          <Link
                            href={href}
                            onClick={close}
                            aria-current={active ? "page" : undefined}
                            className={`block truncate rounded-xl px-4 py-3 text-sm font-semibold ${active ? "bg-(--pv-wash) text-(--pv-red)" : "text-(--pv-muted) hover:bg-(--pv-wash)"}`}
                          >
                            {label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </nav>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
