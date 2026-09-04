import Link from "next/link";
import { MagnifyingGlass, ShoppingBag, User } from "@phosphor-icons/react/dist/ssr";
import { greetingName, initials } from "@pv/backend/domain/person-name";
import { BrandMark } from "@/components/brand-mark";
import { MobileNav } from "@/components/mobile-nav";
import { getCartCount } from "@/server/cart-count";
import { getCustomerPrincipal } from "@/server/customer-session";

/**
 * The header carries no navigation of its own any more. On desktop the sidebar
 * holds it, on a phone the drawer does, and both read the same list from
 * `lib/store-nav` — a third copy across the top was the one most likely to fall
 * behind. What is left here is brand, search, cart and account.
 */

export async function StoreHeader() {
  const [cartCount, customer] = await Promise.all([getCartCount(), getCustomerPrincipal()]);
  const account =
    customer === null
      ? null
      : {
          name: greetingName(customer.fullName, customer.email),
          monogram: initials(customer.fullName, customer.email),
          email: customer.email,
        };

  return (
    <header className="sticky top-0 z-40 border-b border-(--pv-line) bg-[color-mix(in_srgb,var(--pv-page)_92%,transparent)] backdrop-blur-sm">
      <div className="container-shell flex h-[76px] items-center justify-between gap-5">
        <Link href="/" aria-label="Pouch Villa home">
          <BrandMark compact inverse />
        </Link>
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
            Signed out, the icon is an invitation and earns its place in the bar.
            Signed in, it is a fifth control competing with search, cart and menu
            on a 360 px screen while pointing at something the drawer already
            carries — so below `lg` it steps aside and the drawer holds the
            account, with a name on it. The desktop bar has the room, and keeps
            it either way.
          */}
          <Link
            href="/account"
            className={
              account === null
                ? "grid h-11 w-11 place-items-center rounded-xl hover:bg-(--pv-wash)"
                : "hidden h-11 w-11 place-items-center rounded-xl hover:bg-(--pv-wash) lg:grid"
            }
            aria-label={account === null ? "Sign in to your account" : "Your account"}
          >
            <User size={23} weight={account === null ? "regular" : "fill"} />
          </Link>

          <MobileNav account={account} />
        </div>
      </div>
    </header>
  );
}
