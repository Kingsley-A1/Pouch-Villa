import type { CatalogueListItem } from "@pv/backend/services/catalogue";
import { ProductCard } from "@/components/product-card";
import { PouchMark } from "@/components/pouch-mark";

/**
 * An empty catalogue says so plainly. Rule 2: nothing is invented to fill a grid,
 * because a plausible placeholder that reaches production becomes a lie the client
 * discovers in front of a customer.
 */
export function ProductGrid({
  products,
  emptyMessage = "No products have been published yet.",
}: {
  products: CatalogueListItem[];
  emptyMessage?: string;
}) {
  if (products.length === 0) {
    return (
      <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-(--pv-line) p-10 text-center">
        <span className="h-12 w-12 text-(--pv-line)">
          <PouchMark />
        </span>
        <p className="text-sm text-(--pv-muted)">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
