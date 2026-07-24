import Link from "next/link";
import { Heart, List, MagnifyingGlass, MapPin, X } from "@phosphor-icons/react/dist/ssr";
import { BrandMark } from "@/components/brand-mark";

const links = [
  ["Shop", "/shop"], ["Find My Case", "/find-my-case"], ["Collections", "/collections"],
  ["Request a Case", "/request-case"], ["Visit Us", "/visit-us"], ["Help", "/help"],
] as const;

export function StoreHeader() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#e8e3df] bg-white/95 backdrop-blur-sm">
        <div className="container-shell flex h-[76px] items-center justify-between gap-5">
          <Link href="/" aria-label="Pouch Villa home"><BrandMark compact /></Link>
          <nav className="hidden items-center gap-6 lg:flex" aria-label="Main navigation">
            {links.slice(0, 5).map(([label, href]) => <Link key={href} href={href} className="text-sm font-semibold text-zinc-700 transition-colors hover:text-[#e30613]">{label}</Link>)}
          </nav>
          <div className="flex items-center gap-1.5">
            <Link href="/search" className="grid h-11 w-11 place-items-center rounded-xl hover:bg-[#f6f3f1]" aria-label="Search"><MagnifyingGlass size={23} /></Link>
            <Link href="/saved" className="grid h-11 w-11 place-items-center rounded-xl hover:bg-[#f6f3f1]" aria-label="Saved products"><Heart size={23} /></Link>
            <Link href="/visit-us" className="hidden h-11 items-center gap-2 rounded-xl border border-[#e8e3df] px-3 text-sm font-bold hover:border-[#e30613] sm:flex"><MapPin size={19} /> Visit</Link>
            <details className="group relative lg:hidden">
              <summary className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-xl hover:bg-[#f6f3f1]" aria-label="Open menu"><List className="group-open:hidden" size={25} /><X className="hidden group-open:block" size={25} /></summary>
              <nav className="absolute right-0 top-13 w-[min(86vw,320px)] rounded-2xl border border-[#e8e3df] bg-white p-3 shadow-xl" aria-label="Mobile navigation">
                {links.map(([label, href]) => <Link key={href} href={href} className="block rounded-xl px-4 py-3 text-sm font-bold hover:bg-[#f6f3f1]">{label}</Link>)}
              </nav>
            </details>
          </div>
        </div>
      </header>
    </>
  );
}
