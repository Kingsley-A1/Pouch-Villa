import type { Product } from "@pv/backend/domain/types";
import { ProductCard } from "@/components/product-card";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

export function ProductGrid({
  products,
  emptyTitle = "No compatible products found",
}: {
  products: Product[];
  emptyTitle?: string;
}) {
  if (!products.length)
    return (
      <div className="grid min-h-72 place-items-center rounded-3xl border border-dashed border-zinc-300 bg-[#fcfaf8] p-8 text-center">
        <div>
          <MagnifyingGlass size={34} className="mx-auto mb-3 text-zinc-400" />
          <h2 className="text-xl font-bold">{emptyTitle}</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
            Try changing a filter or request a case so staff can help source the right fit.
          </p>
        </div>
      </div>
    );
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
