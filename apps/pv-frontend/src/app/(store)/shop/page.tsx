import type { Metadata } from "next";
import {
  listPublishedProducts,
  listCategoryTree,
  listDevices,
} from "@pv/backend/services/catalogue";
import { ProductGrid } from "@/components/product-grid";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CategoryFilter } from "@/components/category-filter";
import { DeviceFilter } from "@/components/device-filter";
import { toSingle } from "@/lib/utils";

/**
 * Catalogue and settings come from the database, so this renders per request.
 * Prerendering it would freeze the storefront until the next deploy — a product
 * published in the admin must appear immediately.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Shop" };

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const categorySlug = toSingle(params.category);
  const brandSlug = toSingle(params.brand);
  const deviceSlug = toSingle(params.device);

  const [{ products }, categories, devices] = await Promise.all([
    listPublishedProducts({
      ...(categorySlug ? { categorySlug } : {}),
      ...(brandSlug ? { brandSlug } : {}),
      ...(deviceSlug ? { deviceSlug } : {}),
    }),
    listCategoryTree(),
    listDevices(),
  ]);

  const filtered = Boolean(categorySlug || brandSlug || deviceSlug);

  return (
    <>
      <Breadcrumbs trail={[{ label: "Shop" }]} />
      <section className="section-space">
        <div className="container-shell">
          <h1 className="section-title">Shop</h1>
          <CategoryFilter categories={categories} activeSlug={categorySlug} />
          <DeviceFilter devices={devices} activeSlug={deviceSlug} categorySlug={categorySlug} />
          <div className="mt-8">
            <ProductGrid
              products={products}
              emptyMessage={
                filtered
                  ? "Nothing published matches those filters yet."
                  : "The catalogue is empty. Products appear here once staff publish them."
              }
            />
          </div>
        </div>
      </section>
    </>
  );
}
