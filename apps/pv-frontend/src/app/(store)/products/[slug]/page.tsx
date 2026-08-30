import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPublishedProductBySlug } from "@pv/backend/services/catalogue";
import { formatKobo } from "@pv/backend/domain/money";
import { Breadcrumbs } from "@/components/breadcrumbs";

/**
 * Catalogue and settings come from the database, so this renders per request.
 * Prerendering it would freeze the storefront until the next deploy — a product
 * published in the admin must appear immediately.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);
  if (product === null) return { title: "Product not found" };
  return {
    title: product.name,
    ...(product.summary ? { description: product.summary } : {}),
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);
  if (product === null) notFound();

  const hero = product.images[0];

  return (
    <>
      <Breadcrumbs trail={[{ label: "Shop", href: "/shop" }, { label: product.name }]} />
      <section className="section-space">
        <div className="container-shell grid gap-10 lg:grid-cols-2">
          <div className="relative aspect-square overflow-hidden rounded-3xl bg-(--pv-wash)">
            {hero ? (
              <Image
                src={hero.r2Key}
                alt={hero.alt ?? product.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-sm text-(--pv-muted)">
                No image has been uploaded for this product yet.
              </div>
            )}
          </div>

          <div>
            <h1 className="section-title">{product.name}</h1>
            <p className="mt-4 text-2xl font-extrabold text-(--pv-red)">
              {product.fromKobo === null ? "Price on request" : formatKobo(product.fromKobo)}
            </p>
            {product.summary ? (
              <p className="mt-4 leading-7 text-(--pv-muted)">{product.summary}</p>
            ) : null}

            <h2 className="mt-8 text-lg font-bold">Options</h2>
            {product.variants.length === 0 ? (
              <p className="mt-2 text-sm text-(--pv-muted)">
                No variants have been configured for this product yet.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {product.variants.map((variant) => (
                  <li
                    key={variant.id}
                    className="flex min-h-11 items-center justify-between gap-4 rounded-xl border border-(--pv-line) px-4 py-2"
                  >
                    <span className="text-sm font-semibold">
                      {Object.values(variant.axes).join(" · ") || variant.sku}
                    </span>
                    <span className="text-sm tabular-nums">
                      {formatKobo(variant.priceKobo)}
                      {variant.inStock <= 0 ? (
                        <span className="ml-2 text-(--pv-muted)">Out of stock</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {product.description ? (
              <>
                <h2 className="mt-8 text-lg font-bold">Details</h2>
                <p className="mt-2 leading-7 text-(--pv-muted)">{product.description}</p>
              </>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
