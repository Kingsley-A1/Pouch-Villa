import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The logo — the client's supplied file, used as supplied.
 *
 * `public/images/pouch-villa-logo.jpg` is a byte-for-byte copy of
 * `docs/client/brand/logo-flat-red.jpg`. Nothing here recolours it, redraws it
 * or generates a variant of it. An earlier version derived a white lockup from
 * the artwork; the client's instruction was to use this file and nothing else,
 * so that is what this does.
 *
 * **Two things follow from the file being what it is, and both are handled in
 * CSS rather than by editing it.**
 *
 * It is a 1080×1080 square whose artwork occupies 555×441 in the middle — a
 * little over half the width and 41% of the height. Rendered whole it would be
 * a small logo adrift in a large empty box. So the artwork's own bounding box,
 * measured from the file, is framed by an `overflow-hidden` box with the image
 * scaled and offset inside it. Every number below comes from that measurement.
 * They are utility classes, not `style` attributes: a style attribute needs
 * `style-src-attr 'unsafe-inline'`, which §5 rules out.
 *
 * It is a JPEG, so it has no transparency and carries its own white paper. On
 * the red storefront that paper would be a white rectangle around the mark
 * whatever we did, so it is made deliberate instead of accidental: a white
 * rounded plate the logo sits on, which reads as a badge rather than a mistake.
 * On the white admin the plate is invisible and costs nothing.
 *
 * When the client sends a vector or a transparent PNG, the crop maths and the
 * plate both go and this becomes a plain `<Image>`.
 */

/** The artwork's bounding box inside the supplied square, measured from it. */
const ARTWORK_WIDTH = 555;
const ARTWORK_HEIGHT = 441;

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
        // The plate. `bg-white`, not `--pv-surface`: it exists to match the
        // paper baked into the JPEG, which does not follow our tokens.
        "inline-flex shrink-0 overflow-hidden rounded-xl bg-white",
        compact ? "h-11 p-1" : "h-14 p-1.5",
      )}
    >
      <span className="relative block aspect-[555/441] h-full overflow-hidden">
        <Image
          src="/images/pouch-villa-logo.jpg"
          alt={decorative ? "" : "Pouch Villa"}
          width={ARTWORK_WIDTH}
          height={ARTWORK_HEIGHT}
          // On every page and above the fold.
          priority
          sizes="72px"
          /*
            195% wide and pulled up and left, so the artwork's bounding box —
            not the file's empty margin — fills the frame. `max-w-none` because
            the global `img { max-width: 100% }` reset would otherwise clamp it
            straight back to the box it is meant to overflow.
          */
          className="absolute top-[-72.56%] left-[-42.34%] w-[194.59%] max-w-none"
        />
      </span>
    </span>
  );
}
