import Link from "next/link";
import type { StorefrontBrand } from "@pv/backend/services/catalogue";
import { cn } from "@/lib/utils";

/**
 * The brands staff have stocked, as a row of pills under the header.
 *
 * Brand is the question a phone-accessory customer asks first — "do you have
 * anything for a Samsung" — and until now the only way to ask it was to open the
 * shop and find a filter. A strip under the header answers it from any page.
 *
 * A Server Component with plain links, so it ships no JavaScript. It marks no
 * pill as current: knowing which one is active means reading the query string,
 * which in a layout means a client island on every page of the shop, and the
 * shop page already says which filter is applied.
 *
 * The strip scrolls sideways on a narrow screen rather than wrapping to a second
 * row that would push the page content down. §2 forbids the *page* scrolling
 * horizontally, not a strip that owns its own overflow.
 *
 * It renders nothing at all when no brand has a published product behind it — an
 * empty rail under the header is worse than no rail, and a pill leading to an
 * empty page is worse still.
 */
export function BrandNav({ brands }: { brands: StorefrontBrand[] }) {
  if (brands.length === 0) return null;

  return (
    <nav aria-label="Shop by brand" className="border-b border-(--pv-line) bg-(--pv-surface)">
      <div className="container-shell">
        <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1.5">
          {brands.map((brand) => (
            <li key={brand.id} className="shrink-0">
              <Link
                href={`/shop?brand=${brand.slug}`}
                className={cn(
                  // 44 px tall and 8 px apart, per §2. A pill rail is exactly
                  // where a thumb misses on a moving bus.
                  "inline-flex min-h-11 items-center gap-2 rounded-full border border-(--pv-line)",
                  "px-3.5 text-sm font-bold whitespace-nowrap text-(--pv-ink)",
                  "transition-colors duration-150 motion-reduce:transition-none",
                  "hover:border-(--pv-red) hover:bg-(--pv-cream) hover:text-(--pv-red)",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
                )}
              >
                {brand.name}
                {/*
                  The count is decoration beside a name that already carries the
                  meaning, so it is hidden from assistive technology — "iPhone 4"
                  read aloud sounds like a product, not a brand with four items.
                */}
                <span aria-hidden="true" className="text-xs font-semibold text-(--pv-muted)">
                  {brand.productCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
