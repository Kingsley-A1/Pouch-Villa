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
    */
    <nav aria-label="Filter by category" className="-mx-4 mt-6 mb-2 overflow-x-auto px-4 pb-3">
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
        active
          ? "border-(--pv-red) bg-(--pv-red) text-(--pv-on-brand)"
          : "border-(--pv-line) text-(--pv-ink)",
      )}
    >
      {children}
    </Link>
  );
}
