import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
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
          // No radius of its own now that the shell is square: the one-pixel
          // inset that used to keep the card's border from showing as a sliver
          // outside the image corner has nothing left to correct for.
          //
          // Taller than square, at the client's request. A phone case is a
          // portrait object photographed on a portrait phone, so a square crop
          // was cutting the top and bottom off the very thing being sold — 4:5
          // gives the picture back the height it was shot at without making the
          // card so tall that only one row fits on a screen.
          feature ? "aspect-4/3" : "aspect-4/5",
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

      {/*
        A slim rule between the picture and the words. Without it a card whose
        photograph has a pale background runs straight into the product name and
        the card loses its two halves — most visible on the white-backed product
        shots this shop actually uploads.
      */}
      <div className="border-t border-(--pv-line)" />

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
            // `leading-tight` rather than `snug`: at two clamped lines the extra
            // leading was pushing the price further from the name it belongs to
            // than from the card below it.
            "line-clamp-2 leading-tight font-semibold text-balance",
            feature ? "text-lg" : "text-[0.9375rem]",
          )}
        >
          {name}
        </h3>

        {/*
          The price is the loudest thing on the card now, which is what the
          client asked for and is right: the name tells you what it is, the
          price is what decides whether you tap. `font-black` and a size up on
          both, with the name stepped *down* to semibold so the two are not
          competing at the same weight.
        */}
        <p
          className={cn(
            "font-black text-(--pv-red) tabular-nums",
            feature ? "mt-1 text-2xl" : "mt-0.5 text-base",
          )}
        >
          {priceLabel}
        </p>

        {/*
          "View" as an affordance, not a control.

          The whole card is already the link; a real <button> or <a> in here
          would be a control nested inside one, which is invalid HTML and which
          browsers resolve by following the outer link anyway. So this is a
          styled span, hidden from assistive technology — a screen reader
          already hears the card's link named by the product.

          It stays visible on touch, where there is no hover to reveal it, and
          only picks up the brand tint on a pointer that can hover.
        */}
        <span
          aria-hidden="true"
          className={cn(
            "mt-2 inline-flex w-fit items-center gap-1 rounded-full border border-(--pv-line)",
            "px-2.5 py-1 text-[11px] font-bold text-(--pv-muted)",
            "transition-colors duration-200 motion-reduce:transition-none",
            "group-hover:border-(--pv-red) group-hover:text-(--pv-red)",
          )}
        >
          View
          <ArrowRight size={11} weight="bold" />
        </span>
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
 *
 * Square, at the client's instruction. The fill and the hairline border stay:
 * on the storefront's red ground a borderless card dissolves into the page and
 * a grid of them stops reading as a grid.
 */
export const CARD_SHELL_CLASS = cn(
  "group block overflow-hidden rounded-none border border-(--pv-line) bg-(--pv-surface)",
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

  /**
   * A feature tile spans up to the full viewport width on a phone — see
   * `FEATURE_IMAGE_SIZES` — which at 2x device pixels needs more than the
   * `card` derivative has. `hero` is the same file already generated for the
   * product page, so this costs nothing extra to store.
   */
  const imageUrl = image === null ? null : feature ? image.heroUrl : image.cardUrl;

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
            image !== null && imageUrl !== null ? (
              <Image
                src={imageUrl}
                // The product's own name, always. There is no per-image
                // description any more — see `CatalogueImage`.
                alt={product.name}
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
        /*
          The heart sits on the photograph with nothing behind it.

          It used to sit on a translucent plate, and the plate was sized to the
          44px touch target rather than to the 20px glyph — so every card
          carried a large coloured blob in its corner, and the smallest control
          on the card looked like the most important thing on it. `on-media`
          gives the glyph its own shadow instead, which is what the plate was
          really for: staying legible over an image nobody controls.

          The 44px target is untouched and is simply invisible now. Pulled in to
          `top-1 right-1` because a target with no plate no longer needs to clear
          the card's own corner radius.
        */
        <span className="absolute top-1 right-1 flex items-center gap-1">
          <LikeButton
            productId={product.id}
            productName={product.name}
            initialLiked={like.liked}
            initialCount={like.count}
            onMedia
          />
        </span>
      ) : null}
    </div>
  );
}
