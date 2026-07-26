"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, X } from "@phosphor-icons/react";

export function MobileNav({ links }: { links: ReadonlyArray<readonly [string, string]> }) {
  const pathname = usePathname();
  // Remember which route the panel was opened on. The panel counts as open only
  // while that still matches the current route, so navigating anywhere closes it
  // automatically — no effect and no cascading render needed.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn !== null && openedOn === pathname;
  const close = () => setOpenedOn(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenedOn(null); };
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
        className="grid h-11 w-11 place-items-center rounded-xl hover:bg-[#f6f3f1]"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <List size={25} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Close menu" onClick={close} className="absolute inset-0 h-full w-full cursor-default bg-black/40" />
          <nav aria-label="Mobile navigation" className="absolute right-0 top-0 flex h-full w-[min(84vw,340px)] flex-col bg-white shadow-2xl">
            <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-[#e8e3df] px-5">
              <span className="text-sm font-bold tracking-wide text-zinc-500">Menu</span>
              <button type="button" onClick={close} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-[#f6f3f1]" aria-label="Close menu"><X size={23} /></button>
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
                    className={`block truncate rounded-xl px-4 py-3.5 font-bold ${active ? "bg-[#f6f3f1] text-[#e30613]" : "hover:bg-[#f6f3f1]"}`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
