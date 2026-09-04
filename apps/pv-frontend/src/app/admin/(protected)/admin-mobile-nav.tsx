"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowSquareOut, CaretRight, List, Storefront, X } from "@phosphor-icons/react";
import type { NavSection } from "./nav-sections";
import { LogoutButton } from "./logout-button";

/** The signed-in staff member, resolved on the server by the admin layout. */
export type DrawerStaff = { name: string; role: string; monogram: string };

/**
 * The admin drawer, and below `lg` the only place the account lives.
 *
 * The avatar and "Sign out" used to sit in the header beside the menu button.
 * On a 360 px bar that put three controls in a row against a wordmark and a
 * search field, with a destructive action immediately next to the control a
 * thumb reaches for most — and it named neither of them. Here they are a row
 * with a name and a role on it, and a sign-out with room around it.
 */
export function AdminMobileNav({
  sections,
  account,
}: {
  sections: NavSection[];
  account: DrawerStaff;
}) {
  const pathname = usePathname();
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn !== null && openedOn === pathname;
  const close = () => setOpenedOn(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
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
        aria-label="Open admin menu"
        aria-expanded={open}
      >
        <List size={25} />
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-60">
              <button
                type="button"
                aria-label="Close menu"
                onClick={close}
                className="absolute inset-0 h-full w-full cursor-default bg-black/40"
              />
              <nav
                aria-label="Admin sections"
                className="absolute top-0 right-0 flex h-full w-[min(84vw,340px)] flex-col bg-(--pv-surface) shadow-2xl"
              >
                <div className="flex h-16 shrink-0 items-center justify-between border-b border-(--pv-line) px-5">
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
                    Whose session this is, answered before the sections. A shared
                    phone in a shop makes that a real question, and an anonymous
                    avatar in a header never answered it.
                  */}
                  <Link
                    href="/admin/profile"
                    onClick={close}
                    aria-current={pathname === "/admin/profile" ? "page" : undefined}
                    className={`mb-2 flex items-center gap-3 rounded-2xl border p-3 ${
                      pathname === "/admin/profile"
                        ? "border-(--pv-red) bg-[color-mix(in_srgb,var(--pv-red)_7%,var(--pv-surface))]"
                        : "border-(--pv-line) hover:bg-(--pv-wash)"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-(--pv-red) text-xs font-extrabold text-(--pv-on-brand)"
                    >
                      {account.monogram}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{account.name}</span>
                      <span className="block truncate text-xs text-(--pv-muted) capitalize">
                        {account.role}
                      </span>
                    </span>
                    <CaretRight size={16} aria-hidden="true" className="shrink-0" />
                  </Link>

                  {sections.map((section) => {
                    const active = pathname === section.href;
                    return (
                      <Link
                        key={section.href}
                        href={section.href}
                        onClick={close}
                        aria-current={active ? "page" : undefined}
                        className={`block truncate rounded-xl px-4 py-3.5 font-bold ${active ? "bg-(--pv-wash) text-(--pv-red)" : "hover:bg-(--pv-wash)"}`}
                      >
                        {section.label}
                      </Link>
                    );
                  })}

                  {/*
                    The same way back to the shop as the desktop sidebar. The
                    client runs this business from a phone, so leaving it out
                    here would make it a desktop-only convenience.
                  */}
                  <div className="mt-3 grid gap-1 border-t border-(--pv-line) pt-3">
                    <Link
                      href="/"
                      target="_blank"
                      rel="noreferrer"
                      onClick={close}
                      aria-label="View store (opens in a new tab)"
                      className="flex min-h-11 items-center gap-2 truncate rounded-xl px-4 py-3 text-sm font-semibold text-(--pv-muted) hover:bg-(--pv-wash)"
                    >
                      <Storefront aria-hidden="true" size={19} />
                      <span aria-hidden="true" className="flex items-center gap-1.5">
                        View store
                        <ArrowSquareOut size={13} />
                      </span>
                    </Link>

                    {/*
                      Last, and on its own row. Signing out is the one thing in
                      this panel that cannot be undone by tapping something else,
                      so it sits where nothing is reached past it.
                    */}
                    <span className="px-4 py-3">
                      <LogoutButton />
                    </span>
                  </div>
                </div>
              </nav>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
