import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The logo. The client's own artwork, not an approximation of it.
 *
 * This used to be a hand-drawn `PouchMark` beside the words "Pouch Villa" set in
 * Playfair — close, and not the logo. The instruction was "the exact logo and
 * nothing less", so it is now the supplied artwork itself, with the white paper
 * keyed out to transparency by `scripts/generate-logo-assets.mjs`. Nothing is
 * redrawn; every pixel comes from the file the client sent.
 *
 * **Two files, one lockup.** The artwork is red on white, and the site has two
 * grounds: a red storefront and a white admin. Red on red is invisible, so the
 * storefront gets the reversed (white) lockup and the admin keeps the original
 * colour. A one-colour reversal is ordinary brand practice and is still the same
 * mark — it is not a second logo.
 *
 * The wordmark is inside the artwork, so there is no text beside it any more.
 * That also removes the old `max-[359px]:hidden` rule that dropped the words on
 * a narrow phone: the lockup scales as one thing and needs no such exception.
 *
 * **The name lives on the image, not on a wrapper.** It was briefly an
 * `aria-label` on a plain `<span>`, which is a WCAG 4.1.2 violation — an element
 * with no role cannot take one — and axe caught it before it shipped. An `<img>`
 * has a role, so `alt` is the right and only place for it.
 *
 * `decorative` is for the one case where something else already names it: the
 * empty-state illustration in a product grid, where the shop announcing itself a
 * second time would be noise.
 */

/** The artwork's own proportions, so the box is reserved and CLS stays at zero. */
const NATURAL_WIDTH = 560;
const NATURAL_HEIGHT = 445;

export function BrandMark({
  /**
   * `inverse` means "this sits on a ground the red artwork would disappear
   * into" — the storefront, whose page and footer are both brand red.
   */
  inverse = false,
  compact = false,
  decorative = false,
}: {
  inverse?: boolean;
  compact?: boolean;
  decorative?: boolean;
}) {
  const height = compact ? 44 : 56;

  return (
    <span className="inline-flex items-center">
      <Image
        src={inverse ? "/images/pouch-villa-logo-white.png" : "/images/pouch-villa-logo-red.png"}
        alt={decorative ? "" : "Pouch Villa"}
        width={NATURAL_WIDTH}
        height={NATURAL_HEIGHT}
        // The logo is on every page, above the fold, and is frequently the
        // largest thing painted before the hero image loads.
        priority
        sizes={`${Math.round((height * NATURAL_WIDTH) / NATURAL_HEIGHT)}px`}
        className={cn("w-auto", compact ? "h-11" : "h-14")}
      />
    </span>
  );
}
