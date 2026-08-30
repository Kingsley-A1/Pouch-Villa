import Image from "next/image";
import Link from "next/link";
import type { CatalogueListItem } from "@pv/backend/services/catalogue";
import { formatKobo } from "@pv/backend/domain/money";

/**
 * A Server Component: nothing here needs the browser, so nothing here ships to it.
 * The saved-items behaviour that used to live in this file was localStorage-only
 * and is being rebuilt against the customer account.
 */
export function ProductCard({ product }: { product: CatalogueListItem }) {
  const image = product.primaryImage;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block rounded-2xl border border-(--pv-line) focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)"
    >
      <div className="relative aspect-square overflow-hidden rounded-t-2xl bg-(--pv-wash)">
        {image ? (
          <Image
            src={image.r2Key}
            alt={image.alt ?? product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="grid h-full place-items-center text-xs text-(--pv-muted)">
            No image yet
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm leading-snug font-bold">{product.name}</h3>
        <p className="mt-1 text-sm font-extrabold text-(--pv-red)">
          {product.fromKobo === null ? "Price on request" : formatKobo(product.fromKobo)}
        </p>
        {product.inStock <= 0 ? (
          <p className="mt-1 text-xs text-(--pv-muted)">Out of stock</p>
        ) : null}
      </div>
    </Link>
  );
}
