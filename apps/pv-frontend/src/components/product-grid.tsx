import type { CatalogueListItem } from "@pv/backend/services/catalogue";
import { ProductCard } from "@/components/product-card";

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
      <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
        {emptyMessage}
      </p>
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
