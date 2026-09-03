import Image from "next/image";
import Link from "next/link";
import type { CatalogueListItem } from "@pv/backend/services/catalogue";
import { formatKobo } from "@pv/backend/domain/money";
import { LikeButton } from "@/components/like-button";
import { cn } from "@/lib/utils";

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
  brandName = null,
  priceLabel,
  outOfStock,
  imageSlot,
  size = "default",
}: {
  name: string;
  /** Shown as a quiet eyebrow. Omitted where a product has no brand. */
  brandName?: string | null;
  priceLabel: string;
  outOfStock: boolean;
  imageSlot: React.ReactNode;
  /** `feature` is the lead tile in a feature-layout section. */
  size?: "default" | "feature";
}) {
  const feature = size === "feature";

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden bg-(--pv-wash)",
          // The image fills the top of the card, so only its top corners round.
          // One pixel less than the shell's radius, which stops the card's own
          // border showing as a hairline sliver outside the image corner.
          "rounded-t-[15px]",
          feature ? "aspect-4/3" : "aspect-square",
        )}
      >
        {imageSlot}

        {/*
          A badge on the image rather than a third line of text. As text it
          added a line to some cards and not others, so a row of cards sat at
          different heights and the grid looked broken rather than informative.
        */}
        {outOfStock ? (
          <span className="absolute bottom-2 left-2 rounded-full bg-[color-mix(in_srgb,var(--pv-surface)_92%,transparent)] px-2.5 py-1 text-[11px] font-bold tracking-wide text-(--pv-muted) uppercase backdrop-blur-sm">
            Out of stock
          </span>
        ) : null}
      </div>

      <div className={cn("grid gap-1", feature ? "p-5" : "p-3.5")}>
        {brandName ? (
          <p className="text-[11px] font-bold tracking-[.1em] text-(--pv-muted) uppercase">
            {brandName}
          </p>
        ) : null}

        {/*
          Clamped to two lines. A long product name used to push the price out
          of line with the cards beside it; clamping keeps every price on the
          same baseline across a row.
        */}
        <h3
          className={cn(
            "line-clamp-2 leading-snug font-bold text-balance",
            feature ? "text-lg" : "text-sm",
          )}
        >
          {name}
        </h3>

        <p
          className={cn(
            "font-extrabold text-(--pv-red) tabular-nums",
            feature ? "mt-1 text-xl" : "text-sm",
          )}
        >
          {priceLabel}
        </p>
      </div>
    </>
  );
}

/**
 * The shell.
 *
 * `bg-(--pv-surface)` matters in dark mode: without it the card is the page
 * colour and the border is the only thing separating it from the background,
 * which reads as a wireframe rather than a card.
 */
export const CARD_SHELL_CLASS = cn(
  "group block overflow-hidden rounded-2xl border border-(--pv-line) bg-(--pv-surface)",
  "transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none",
  "hover:border-[color-mix(in_srgb,var(--pv-red)_38%,var(--pv-line))] hover:shadow-[0_6px_24px_-12px_var(--pv-shadow)]",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
);

export const CARD_IMAGE_SIZES = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

/** A feature tile spans two columns, so it needs its own size hint. */
export const FEATURE_IMAGE_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 66vw, 50vw";

/**
 * A Server Component: the card itself ships no JavaScript. Only the heart is a
 * client island, and only when the page supplies like state for it.
 *
 * The heart is a sibling of the link, not a child. A `<button>` inside an `<a>`
 * is invalid HTML, and browsers resolve it by following the link — so nesting it
 * would make liking a product navigate away from the grid instead.
 */
export function ProductCard({
  product,
  like,
  size = "default",
}: {
  product: CatalogueListItem;
  like?: { count: number; liked: boolean };
  size?: "default" | "feature";
}) {
  const image = product.primaryImage;
  const feature = size === "feature";

  return (
    <div className="relative h-full">
      <Link href={`/products/${product.slug}`} className={cn(CARD_SHELL_CLASS, "h-full")}>
        <ProductCardFace
          name={product.name}
          brandName={product.brandName}
          priceLabel={product.fromKobo === null ? "Price on request" : formatKobo(product.fromKobo)}
          outOfStock={product.inStock <= 0}
          size={size}
          imageSlot={
            image ? (
              <Image
                src={image.cardUrl}
                alt={image.alt ?? product.name}
                fill
                sizes={feature ? FEATURE_IMAGE_SIZES : CARD_IMAGE_SIZES}
                className={cn(
                  "object-cover",
                  // Slower and eased, so the zoom reads as considered rather
                  // than twitchy. Neutralised under prefers-reduced-motion.
                  "transition-transform duration-500 ease-out group-hover:scale-[1.04]",
                  "motion-reduce:transition-none motion-reduce:group-hover:scale-100",
                )}
              />
            ) : (
              <div className="grid h-full place-items-center text-xs text-(--pv-muted)">
                No image yet
              </div>
            )
          }
        />
      </Link>

      {like ? (
        <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--pv-surface)_86%,transparent)] pr-2 shadow-[0_2px_8px_-4px_var(--pv-shadow)] backdrop-blur-sm">
          <LikeButton
            productId={product.id}
            productName={product.name}
            initialLiked={like.liked}
            initialCount={like.count}
          />
        </span>
      ) : null}
    </div>
  );
}
