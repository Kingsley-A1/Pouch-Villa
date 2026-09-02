"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, X } from "@phosphor-icons/react";

type NavLinks = ReadonlyArray<readonly [string, string]>;

export function MobileNav({
  links,
  infoLinks,
  signedIn,
}: {
  links: NavLinks;
  infoLinks: NavLinks;
  signedIn: boolean;
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
                  {links.map(([label, href]) => {
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
                    Sits with the shopping links rather than under Information:
                    signing in is a thing you do, not a page you read.
                  */}
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
                    {signedIn ? "Your account" : "Sign in"}
                  </Link>

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
                    {infoLinks.map(([label, href]) => {
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
