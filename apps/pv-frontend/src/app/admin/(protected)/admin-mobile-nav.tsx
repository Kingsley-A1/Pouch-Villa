"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, X } from "@phosphor-icons/react";
import type { NavSection } from "./nav-sections";

export function AdminMobileNav({ sections }: { sections: NavSection[] }) {
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
                </div>
              </nav>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
