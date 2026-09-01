import Link from "next/link";
import { MagnifyingGlass, ShoppingBag } from "@phosphor-icons/react/dist/ssr";
import { BrandMark } from "@/components/brand-mark";
import { MobileNav } from "@/components/mobile-nav";
import { getCartCount } from "@/server/cart-count";

const links = [
  ["Shop", "/shop"],
  ["Categories", "/categories"],
  ["Track order", "/track"],
  ["Contact", "/contact"],
] as const;

export async function StoreHeader() {
  const cartCount = await getCartCount();

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

          {/*
            The count is in the accessible name rather than only in the badge,
            so a screen reader announces "Your cart, 3 items" instead of leaving
            the number as decoration next to an unlabelled icon.
          */}
          <Link
            href="/cart"
            className="relative grid h-11 w-11 place-items-center rounded-xl hover:bg-(--pv-wash)"
            aria-label={
              cartCount === 0
                ? "Your cart, empty"
                : `Your cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`
            }
          >
            <ShoppingBag size={23} />
            {cartCount > 0 ? (
              <span
                aria-hidden="true"
                className="absolute top-1 right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-(--pv-red) px-1 text-[11px] font-bold text-white tabular-nums"
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            ) : null}
          </Link>

          <MobileNav links={links} />
        </div>
      </div>
    </header>
  );
}
