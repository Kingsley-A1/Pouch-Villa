import Image from "next/image";
import Link from "next/link";
import type { CatalogueListItem } from "@pv/backend/services/catalogue";
import { formatKobo } from "@pv/backend/domain/money";

/**
 * The card's appearance, with no link and no data source.
 *
 * Split out so the admin's pre-publish preview can render the *exact* card a
 * shopper will see, from files that are still only in the browser. A preview
 * built from a copy of this markup would drift the first time either changed;
 * sharing the component is what makes the preview trustworthy.
 *
 * `imageSlot` rather than an image URL: the storefront has a CDN URL for
 * `next/image` to optimise, while the preview has a local `blob:` URL that the
 * optimiser cannot fetch. Each passes in what it can render.
 */
export function ProductCardFace({
  name,
  priceLabel,
  outOfStock,
  imageSlot,
}: {
  name: string;
  priceLabel: string;
  outOfStock: boolean;
  imageSlot: React.ReactNode;
}) {
  return (
    <>
      <div className="relative aspect-square overflow-hidden rounded-t-2xl bg-(--pv-wash)">
        {imageSlot}
      </div>
      <div className="p-3">
        <h3 className="text-sm leading-snug font-bold">{name}</h3>
        <p className="mt-1 text-sm font-extrabold text-(--pv-red)">{priceLabel}</p>
        {outOfStock ? <p className="mt-1 text-xs text-(--pv-muted)">Out of stock</p> : null}
      </div>
    </>
  );
}

export const CARD_SHELL_CLASS =
  "group block rounded-2xl border border-(--pv-line) focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)";

export const CARD_IMAGE_SIZES = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

/**
 * A Server Component: nothing here needs the browser, so nothing here ships to it.
 * The saved-items behaviour that used to live in this file was localStorage-only
 * and is being rebuilt against the customer account.
 */
export function ProductCard({ product }: { product: CatalogueListItem }) {
  const image = product.primaryImage;

  return (
    <Link href={`/products/${product.slug}`} className={CARD_SHELL_CLASS}>
      <ProductCardFace
        name={product.name}
        priceLabel={product.fromKobo === null ? "Price on request" : formatKobo(product.fromKobo)}
        outOfStock={product.inStock <= 0}
        imageSlot={
          image ? (
            <Image
              src={image.cardUrl}
              alt={image.alt ?? product.name}
              fill
              sizes={CARD_IMAGE_SIZES}
              className="object-cover transition group-hover:scale-[1.02]"
            />
          ) : (
            <div className="grid h-full place-items-center text-xs text-(--pv-muted)">
              No image yet
            </div>
          )
        }
      />
    </Link>
  );
}
