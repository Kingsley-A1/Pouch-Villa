import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The logo — the client's supplied artwork, cropped to itself.
 *
 * `public/images/pouch-villa-logo-mark.png` is generated from
 * `docs/client/brand/logo-flat-red.jpg` by `scripts/generate-logo-mark.mjs`,
 * which trims the blank paper off the supplied 1080×1080 square and nothing
 * else. Same pixels, same colours, no trace and no redraw.
 *
 * **This used to be scaled to 195% and offset to crop the margin in CSS**, and
 * that is why the header logo looked soft: `next/image` sized the file for a
 * 44px box and the browser then blew it up. Cropping the file instead means the
 * served image *is* the mark, so it renders at 1:1 or better at every size the
 * app asks for.
 *
 * The white plate stays. The source is a JPEG with no transparency, so on the
 * red storefront it would carry a white rectangle whatever we did; drawn as a
 * rounded plate that reads as a badge rather than as a mistake. On the white
 * admin it costs nothing.
 *
 * When the client sends a vector or a transparent PNG, the plate goes too.
 */

/** The trimmed artwork's real dimensions, from the generated file. */
const MARK_WIDTH = 562;
const MARK_HEIGHT = 443;

export function BrandMark({
  compact = false,
  /**
   * Set where something else already names the shop — the empty-state
   * illustration in a product grid, where announcing it twice is noise.
   */
  decorative = false,
}: {
  compact?: boolean;
  decorative?: boolean;
}) {
  return (
    <span
      className={cn(
        // `bg-white`, not `--pv-surface`: the plate exists to match the paper
        // baked into the artwork, which does not follow our tokens.
        "inline-flex shrink-0 items-center overflow-hidden rounded-xl bg-white",
        compact ? "h-11 px-2 py-1.5" : "h-14 px-2.5 py-2",
      )}
    >
      <Image
        src="/images/pouch-villa-logo-mark.png"
        alt={decorative ? "" : "Pouch Villa"}
        width={MARK_WIDTH}
        height={MARK_HEIGHT}
        // On every page and above the fold.
        priority
        /*
          Generous rather than exact. The mark renders about 45px wide in the
          compact header and 60px otherwise; asking for 128 lets `next/image`
          serve a bitmap that is still crisp on a 2× and 3× phone screen, which
          is what most of this shop's visitors are on. It is a ~4KB PNG.
        */
        sizes="128px"
        className="h-full w-auto"
      />
    </span>
  );
}
