import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { BrandMark } from "@/components/brand-mark";
import { MobileNav } from "@/components/mobile-nav";

const links = [
  ["Shop", "/shop"],
  ["Categories", "/categories"],
] as const;

export function StoreHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-(--pv-line) bg-white/95 backdrop-blur-sm">
      <div className="container-shell flex h-[76px] items-center justify-between gap-5">
        <Link href="/" aria-label="Pouch Villa home">
          <BrandMark compact />
        </Link>
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Main navigation">
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-semibold text-zinc-700 transition-colors hover:text-(--pv-red)"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <Link
            href="/search"
            className="grid h-11 w-11 place-items-center rounded-xl hover:bg-(--pv-wash)"
            aria-label="Search"
          >
            <MagnifyingGlass size={23} />
          </Link>
          <MobileNav links={links} />
        </div>
      </div>
    </header>
  );
}
