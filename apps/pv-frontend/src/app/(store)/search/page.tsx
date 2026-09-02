import type { Metadata } from "next";
import { listPublishedProducts } from "@pv/backend/services/catalogue";
import { ProductGrid } from "@/components/product-grid";
import { likeSummaryFor } from "@/server/product-likes";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { toSingle } from "@/lib/utils";
import { SearchField } from "./search-field";

/**
 * Catalogue and settings come from the database, so this renders per request.
 * Prerendering it would freeze the storefront until the next deploy — a product
 * published in the admin must appear immediately.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const term = toSingle(params.q).trim();
  const { products } = term ? await listPublishedProducts({ search: term }) : { products: [] };
  const likes = await likeSummaryFor(products);

  return (
    <>
      <Breadcrumbs trail={[{ label: "Search" }]} />
      <section className="section-space">
        <div className="container-shell">
          <h1 className="section-title">Search</h1>

          <form action="/search" role="search" className="mt-6 flex gap-2">
            <label htmlFor="q" className="sr-only">
              Search products
            </label>
            <SearchField term={term} />
            <button className="button-primary min-h-11">Search</button>
          </form>

          <div className="mt-8">
            {term ? (
              <ProductGrid
                products={products}
                likes={likes}
                emptyMessage={`Nothing matched “${term}”.`}
              />
            ) : (
              <p className="text-sm text-(--pv-muted)">Enter a search term above.</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
