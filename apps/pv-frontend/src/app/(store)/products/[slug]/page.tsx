import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPublishedProductBySlug } from "@pv/backend/services/catalogue";
import { formatKobo } from "@pv/backend/domain/money";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { getRatingSummary, listApprovedReviews } from "@pv/backend/services/reviews";
import { ReviewModal } from "@/components/review-modal";
import { truncateAtWord } from "@/lib/utils";
import { AddToCart } from "./add-to-cart";

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
    // Search engines truncate around 160 characters, so the description is cut
    // on a word boundary rather than mid-word by the crawler.
    ...(product.description ? { description: truncateAtWord(product.description, 160) } : {}),
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);
  if (product === null) notFound();

  // Fetched together: latency on this cluster is per-statement, so two
  // sequential awaits would cost a visible second on a product page.
  const [reviews, summary] = await Promise.all([
    listApprovedReviews(product.id),
    getRatingSummary(product.id),
  ]);

  const hero = product.images[0];

  return (
    <>
      <Breadcrumbs trail={[{ label: "Shop", href: "/shop" }, { label: product.name }]} />
      <section className="section-space">
        <div className="container-shell grid gap-10 lg:grid-cols-2">
          <div className="relative aspect-square overflow-hidden rounded-3xl bg-(--pv-wash)">
            {hero ? (
              <Image
                src={hero.heroUrl}
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

            {/*
              Money is formatted on the server, so a `Kobo` never crosses the
              client boundary as a bare number that could be read as naira.
            */}
            <AddToCart
              productName={product.name}
              variants={product.variants.map((variant) => ({
                id: variant.id,
                label: Object.values(variant.axes).join(" · ") || variant.sku,
                priceLabel: formatKobo(variant.priceKobo),
                inStock: variant.inStock,
              }))}
            />

            {product.description ? (
              <>
                <h2 className="mt-8 text-lg font-bold">Details</h2>
                <p className="mt-2 leading-7 text-(--pv-muted)">{product.description}</p>
              </>
            ) : null}
          </div>
        </div>

        <div className="container-shell mt-14">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-bold">
              Reviews
              {summary.count > 0 ? (
                <span className="ml-2 text-base font-semibold text-(--pv-muted)">
                  {summary.average?.toFixed(1)} out of 5 · {summary.count}{" "}
                  {summary.count === 1 ? "review" : "reviews"}
                </span>
              ) : null}
            </h2>
            {/* No sign-in wall and no separate page — Q9 and Q2. */}
            <ReviewModal productId={product.id} productName={product.name} />
          </div>

          {reviews.length === 0 ? (
            <p className="mt-4 text-(--pv-muted)">
              No reviews yet. Be the first to say what you think.
            </p>
          ) : (
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {reviews.map((review) => (
                <li key={review.id} className="card-surface p-5">
                  <p className="font-bold">{review.authorName}</p>
                  <p className="mt-0.5 text-sm text-(--pv-muted)">
                    {review.rating} out of 5{review.verifiedPurchase ? " · Verified purchase" : ""}
                  </p>
                  {review.title ? <p className="mt-2 font-semibold">{review.title}</p> : null}
                  <p className="mt-1 leading-7 text-(--pv-muted)">{review.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
