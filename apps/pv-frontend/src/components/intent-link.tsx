"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * A `Link` that prefetches when a shopper shows they might use it — the pointer
 * reaches it, a finger lands on it, or keyboard focus arrives — instead of the
 * moment it scrolls into view.
 *
 * For the shop's chrome only: the header, sidebar, footer, mobile menu and
 * breadcrumbs. Those render on every page, every route behind them is dynamic,
 * and Next prefetches a dynamic route by asking the server for it, so each page
 * view used to start a server render for every one of them whether anyone
 * tapped it or not, and on this plan every render counts against a monthly
 * allowance of function time (November 2026). Product cards and category tiles
 * keep the default: they are where a
 * shopper is about to go, and arriving instantly there is the point.
 *
 * The prefetch still starts before the click — a touch begins a tap before it
 * ends — so a tap on a chrome link loses only the head start the viewport
 * prefetch used to give. Next's own Link and the hover-prefetch pattern in its
 * prefetching guide are the model; see `node_modules/next/dist/docs/01-app/02-guides/prefetching.md`.
 */
export function IntentLink({
  prefetch,
  onMouseEnter,
  onTouchStart,
  onFocus,
  ...rest
}: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  // An explicit `prefetch={false}` from a caller stays off.
  const active = intent && prefetch !== false;

  return (
    <Link
      {...rest}
      prefetch={active ? (prefetch ?? null) : false}
      onMouseEnter={(event) => {
        setIntent(true);
        onMouseEnter?.(event);
      }}
      onTouchStart={(event) => {
        setIntent(true);
        onTouchStart?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
    />
  );
}
