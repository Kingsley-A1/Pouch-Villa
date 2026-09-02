import Link from "next/link";
import { MagnifyingGlass, ShoppingBag, User } from "@phosphor-icons/react/dist/ssr";
import { BrandMark } from "@/components/brand-mark";
import { MobileNav } from "@/components/mobile-nav";
import { getCartCount } from "@/server/cart-count";
import { getCustomerPrincipal } from "@/server/customer-session";

/** The shopping path. Few enough to sit across the desktop header. */
const links = [
  ["Shop", "/shop"],
  ["Categories", "/categories"],
  ["Track order", "/track"],
  ["Contact", "/contact"],
] as const;

/**
 * The supporting pages, reachable from the drawer as well as the footer.
 *
 * Deliberately not added to the desktop header: eight top-level links would
 * bury the four that lead to a sale. On a phone the footer is a long scroll
 * away, so someone looking for the returns policy mid-purchase — exactly when
 * they are deciding whether to buy — would otherwise have to hunt for it.
 */
const infoLinks = [
  ["About us", "/about"],
  ["Returns & warranty", "/returns"],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
] as const;

export async function StoreHeader() {
  const [cartCount, customer] = await Promise.all([getCartCount(), getCustomerPrincipal()]);
  const signedIn = customer !== null;

  return (
    <header className="sticky top-0 z-40 border-b border-(--pv-line) bg-[color-mix(in_srgb,var(--pv-page)_92%,transparent)] backdrop-blur-sm">
      <div className="container-shell flex h-[76px] items-center justify-between gap-5">
        <Link href="/" aria-label="Pouch Villa home">
          <BrandMark compact />
        </Link>
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Main navigation">
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-semibold text-(--pv-ink) transition-colors hover:text-(--pv-red)"
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
                className="absolute top-1 right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-(--pv-red) px-1 text-[11px] font-bold text-(--pv-on-brand) tabular-nums"
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            ) : null}
          </Link>

          {/*
            One destination whether or not they are signed in — the account area
            redirects to sign-in itself. Two different icons in the same place
            would make the header shift as the session state resolves, and the
            accessible name carries the difference that matters.
          */}
          <Link
            href="/account"
            className="grid h-11 w-11 place-items-center rounded-xl hover:bg-(--pv-wash)"
            aria-label={signedIn ? "Your account" : "Sign in to your account"}
          >
            <User size={23} weight={signedIn ? "fill" : "regular"} />
          </Link>

          <MobileNav links={links} infoLinks={infoLinks} signedIn={signedIn} />
        </div>
      </div>
    </header>
  );
}
