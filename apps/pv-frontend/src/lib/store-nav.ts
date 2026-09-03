/**
 * The storefront's navigation, defined once.
 *
 * Three surfaces render this: the desktop sidebar, the phone drawer, and the
 * footer. They had begun to drift — the header carried four links, the drawer
 * carried those plus four more, and the footer listed a different subset again —
 * so a page added to one was reachable from one place and invisible from the
 * others. Pure data, no imports, so every surface reads the same list.
 */

export type StoreLink = { label: string; href: string };

/** The shopping path: what someone came here to do. */
export const SHOP_LINKS: readonly StoreLink[] = [
  { label: "Shop", href: "/shop" },
  { label: "Categories", href: "/categories" },
  { label: "Track order", href: "/track" },
  { label: "Contact", href: "/contact" },
];

/**
 * The supporting pages. A quieter group everywhere they appear: they matter when
 * someone is deciding whether to buy, and they must not compete with the four
 * links above for the same attention.
 */
export const INFO_LINKS: readonly StoreLink[] = [
  { label: "About us", href: "/about" },
  { label: "Returns & warranty", href: "/returns" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

/**
 * Whether a nav link should read as the current page.
 *
 * `/shop` must not light up on `/shopping-something`, so a prefix match requires
 * a `/` boundary. The home link is exact — every path starts with `/`.
 */
export function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
