import Link from "next/link";
import type { CategoryNode } from "@pv/backend/services/catalogue";
import { cn } from "@/lib/utils";

/**
 * Two tiers, flattened into one scrollable row of links. Links rather than a
 * dropdown so each filter is a real URL — shareable, back-button friendly, and
 * indexable.
 */
export function CategoryFilter({
  categories,
  activeSlug,
}: {
  categories: CategoryNode[];
  activeSlug?: string;
}) {
  if (categories.length === 0) return null;

  const entries = categories.flatMap((parent) => [parent, ...parent.children]);

  return (
    /*
      `pb-3` is what separates the pills from the scrollbar underneath them.

      Without it the scroll control sits flush against the bottom edge of the
      pills — on a desktop trackpad the bar appears over them, and on a phone the
      overflow shadow reads as a line drawn through the row. The padding is on
      the scrolling element so it scrolls with the content rather than clipping
      it, and the section below gets its own margin so the two are not competing
      for the same gap.

      `bleed-gutter` rather than `-mx-4`: the row runs out to the container's
      own gutter, whatever that currently is. Hardcoding 1rem overhung the
      0.625rem gutter this container uses below 768 px, and 6 px of overhang on
      each side is what put a horizontal scrollbar on every shop page at 360 px.
    */
    <nav aria-label="Filter by category" className="bleed-gutter mt-6 mb-2 overflow-x-auto pb-3">
      <ul className="flex w-max gap-2">
        <li>
          <FilterLink href="/shop" active={!activeSlug}>
            All
          </FilterLink>
        </li>
        {entries.map((category) => (
          <li key={category.id}>
            <FilterLink
              href={`/shop?category=${category.slug}`}
              active={activeSlug === category.slug}
            >
              {category.name}
            </FilterLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      // 44px minimum target, per the mobile-first floor.
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold",
        "transition-[background-color,border-color,color] duration-200 motion-reduce:transition-none",
        active
          ? // The filled pill takes the accent as its ground, so its label has
            // to be the colour that sits *on* the accent — white text on a white
            // pill is what this reads as otherwise, on the red storefront where
            // `--pv-red` resolves to white.
            "border-(--pv-red) bg-(--pv-red) text-(--pv-on-brand)"
          : cn(
              "border-(--pv-line) text-(--pv-ink)",
              // Hovering an unselected pill has to say "this is the tappable
              // thing" without pretending to be the selected one: the border
              // takes the accent, the ground only tints towards it.
              "hover:border-(--pv-red) hover:bg-[color-mix(in_srgb,var(--pv-red)_14%,transparent)]",
            ),
      )}
    >
      {children}
    </Link>
  );
}
