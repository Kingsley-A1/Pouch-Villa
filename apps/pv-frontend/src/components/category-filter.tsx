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
    <nav aria-label="Filter by category" className="-mx-4 mt-6 overflow-x-auto px-4">
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
