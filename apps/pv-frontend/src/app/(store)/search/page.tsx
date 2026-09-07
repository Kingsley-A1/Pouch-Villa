import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, DeviceMobile } from "@phosphor-icons/react/dist/ssr";
import { listDevices, listPublishedProducts } from "@pv/backend/services/catalogue";
import { findDeviceInPhrase } from "@pv/backend/domain/device-match";
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

  /**
   * Product search cannot answer "iPhone 13 case" on its own.
   *
   * The full-text index covers a product's own name, summary and description —
   * which is right — but what a pouch fits lives in the compatibility table, not
   * in its name. So a query naming a model is checked against the device list
   * as well, and when one is found the shopper is offered the filtered shop
   * alongside the ordinary results rather than being left with none.
   */
  const [{ products }, devices] = await Promise.all([
    term ? listPublishedProducts({ search: term }) : Promise.resolve({ products: [] }),
    term ? listDevices() : Promise.resolve([]),
  ]);
  const device = term ? findDeviceInPhrase(term, devices) : null;
  const likes = await likeSummaryFor(products);

  return (
    <>
      <Breadcrumbs trail={[{ label: "Search" }]} />
      <section className="section-space">
        <div className="container-shell">
          <h1 className="section-title">Search</h1>

          {/*
            Capped rather than full-bleed. On a wide screen the field was running
            the whole width of the page, which made a one-word query look lost in
            it and put the Search button an inch from the last character typed.
          */}
          <form action="/search" role="search" className="mt-6 flex max-w-xl gap-2">
            <label htmlFor="q" className="sr-only">
              Search products
            </label>
            <SearchField term={term} />
            <button className="button-primary min-h-11">Search</button>
          </form>

          {device !== null ? (
            <Link
              href={`/shop?device=${device.slug}`}
              className="mt-6 flex min-h-11 items-center gap-3 rounded-2xl border border-(--pv-red) bg-[color-mix(in_srgb,var(--pv-red)_7%,var(--pv-surface))] p-4"
            >
              <DeviceMobile size={22} aria-hidden="true" className="shrink-0 text-(--pv-red)" />
              <span className="min-w-0 flex-1">
                <span className="block font-bold">
                  See everything that fits the {device.brandName} {device.name}
                </span>
                <span className="block text-sm text-(--pv-muted)">
                  Filtered by what actually fits, not by what the name says.
                </span>
              </span>
              <ArrowRight size={18} aria-hidden="true" className="shrink-0 text-(--pv-red)" />
            </Link>
          ) : null}

          <div className="mt-8">
            {term ? (
              <ProductGrid
                products={products}
                likes={likes}
                emptyMessage={
                  device === null
                    ? `Nothing matched “${term}”.`
                    : `No product is named “${term}”, but the link above shows what fits that phone.`
                }
              />
            ) : (
              <p className="text-sm text-(--pv-muted)">
                Enter a search term above, or your phone model.
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
