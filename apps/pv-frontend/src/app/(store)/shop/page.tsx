import type { Metadata } from "next";
import {
  listPublishedProducts,
  listCategoryTree,
  listDevices,
} from "@pv/backend/services/catalogue";
import { ProductGrid } from "@/components/product-grid";
import { likeSummaryFor } from "@/server/product-likes";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CategoryFilter } from "@/components/category-filter";
import { DeviceFinder } from "@/components/device-finder";
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
  const activeDevice = devices.find((device) => device.slug === deviceSlug) ?? null;
  const likes = await likeSummaryFor(products);

  return (
    <>
      <Breadcrumbs trail={[{ label: "Shop" }]} />
      <section className="section-space">
        <div className="container-shell">
          <h1 className="section-title">Shop</h1>
          <CategoryFilter categories={categories} activeSlug={categorySlug} />
          {/*
            The device finder sits above the grid, not beside it: on a phone
            "does it fit" is the first question, and a filter a shopper has to
            scroll past the results to find is a filter nobody uses.
          */}
          <div className="mt-5 max-w-md">
            <DeviceFinder devices={devices} activeSlug={deviceSlug} categorySlug={categorySlug} />
          </div>
          <div className="mt-8">
            <ProductGrid
              products={products}
              likes={likes}
              emptyMessage={emptyMessage(activeDevice, filtered)}
            />
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * An empty grid should say which of the filters emptied it.
 *
 * "Nothing matches those filters" leaves a shopper who picked their phone
 * wondering whether the shop is empty or their model is unsupported. Naming the
 * device answers that, and it is the case most likely to happen: a catalogue
 * covers far fewer models than exist.
 */
function emptyMessage(
  device: { brandName: string; name: string } | null,
  filtered: boolean,
): string {
  if (device !== null) {
    return `Nothing published fits the ${device.brandName} ${device.name} yet. Try another device, or browse everything.`;
  }
  if (filtered) return "Nothing published matches those filters yet.";
  return "The catalogue is empty. Products appear here once staff publish them.";
}
