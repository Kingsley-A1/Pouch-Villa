import type { CatalogueListItem } from "@pv/backend/services/catalogue";
import type { LikeSummary } from "@/server/product-likes";
import { ProductCard } from "@/components/product-card";
import { BrandMark } from "@/components/brand-mark";

/**
 * An empty catalogue says so plainly. Rule 2: nothing is invented to fill a grid,
 * because a plausible placeholder that reaches production becomes a lie the client
 * discovers in front of a customer.
 */
export function ProductGrid({
  products,
  emptyMessage = "No products have been published yet.",
  likes,
}: {
  products: CatalogueListItem[];
  emptyMessage?: string;
  /**
   * Supplied by the page, never fetched here — this component is presentational
   * (AGENTS.md §7). Omitted, the grid renders without hearts and ships no
   * client JavaScript at all.
   */
  likes?: LikeSummary;
}) {
  if (products.length === 0) {
    return (
      <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-(--pv-line) p-10 text-center">
        {/* Dimmed rather than full strength: it is decoration marking an empty
            shelf, not the shop announcing itself a second time on the page. */}
        <span className="opacity-40">
          <BrandMark compact decorative />
        </span>
        <p className="text-sm text-(--pv-muted)">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => {
        const like = likes?.get(product.id);
        return <ProductCard key={product.id} product={product} {...(like ? { like } : {})} />;
      })}
    </div>
  );
}
