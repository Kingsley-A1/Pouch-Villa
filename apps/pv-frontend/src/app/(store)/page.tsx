import Link from "next/link";
import { listPublishedProducts, listCategoryTree } from "@pv/backend/services/catalogue";
import { pick, readSettings } from "@pv/backend/services/settings";
import { ProductGrid } from "@/components/product-grid";
import { AwaitingConfirmation } from "@/components/awaiting-confirmation";

/**
 * Catalogue and settings come from the database, so this renders per request.
 * Prerendering it would freeze the storefront until the next deploy — a product
 * published in the admin must appear immediately.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ products }, categories, settings] = await Promise.all([
    listPublishedProducts({ limit: 8 }),
    listCategoryTree(),
    readSettings(["store.address", "store.opening_hours"]),
  ]);

  const address = pick(settings, "store.address");
  const hours = pick(settings, "store.opening_hours");

  return (
    <>
      <section className="section-space">
        <div className="container-shell">
          <h1 className="section-title">Pouches, protection and gadget accessories.</h1>
          <p className="mt-4 max-w-xl leading-7 text-(--pv-muted)">
            Browse the range, pick your options, and order with payment by transfer.
          </p>
          <Link href="/shop" className="button-primary mt-8 inline-flex">
            Shop the range
          </Link>
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="section-space">
          <div className="container-shell">
            <h2 className="section-title">Categories</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/shop?category=${category.slug}`}
                    className="flex min-h-11 items-center rounded-xl border border-(--pv-line) px-4 font-semibold"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="section-space">
        <div className="container-shell">
          <h2 className="section-title">Latest</h2>
          <div className="mt-6">
            <ProductGrid
              products={products}
              emptyMessage="The catalogue is being set up. Products appear here once staff publish them."
            />
          </div>
        </div>
      </section>

      <section className="section-space">
        <div className="container-shell grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="text-lg font-bold">Store address</h2>
            {address.present ? (
              <p className="mt-2 text-(--pv-muted)">{address.value}</p>
            ) : (
              <AwaitingConfirmation what="store address" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold">Opening hours</h2>
            {hours.present ? (
              <p className="mt-2 text-(--pv-muted)">{hours.value}</p>
            ) : (
              <AwaitingConfirmation what="opening hours" />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
