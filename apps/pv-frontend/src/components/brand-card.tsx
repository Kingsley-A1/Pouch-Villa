import Link from "next/link";
import Image from "next/image";
import type { StorefrontBrand } from "@pv/backend/services/catalogue";
import { cn } from "@/lib/utils";

/**
 * One brand on the browse path, carried by its logo.
 *
 * The client asked for this specifically: a square card holding the logo
 * prominently, with the name on a single line beneath it. That is why it is not
 * `ChoiceTile` — a tile is a line of text and an arrow, which is the right
 * answer for a step that has no picture and the wrong one for a step whose whole
 * job is now recognition. A shopper looking for their phone finds the Apple logo
 * faster than they read the word.
 *
 * Square, per the client's rule that anything holding content loses its radius.
 *
 * `data-filter-label` is what the instant filter matches against — see
 * `instant-filter.tsx`. It is on the list item rather than here so that hiding a
 * card hides its whole grid cell.
 */
export function BrandCard({ brand, href }: { brand: StorefrontBrand; href: string }) {
  const { logo, name, productCount } = brand;

  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-none border bg-(--pv-surface)",
        "border-(--pv-line) transition-[border-color,box-shadow,transform] duration-200",
        "hover:-translate-y-0.5 hover:border-(--pv-ink)",
        "hover:shadow-[0_10px_30px_-16px_var(--pv-shadow)]",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-focus)",
      )}
    >
      {/*
        A square well for the logo, padded so a wide wordmark and a square glyph
        both sit correctly. `object-contain`, never `cover`: a cropped logo is a
        damaged logo, and the client was explicit about the mark being exact.
      */}
      <span className="grid aspect-square place-items-center bg-(--pv-wash) p-5">
        {logo === null ? (
          // Not an empty box. The brand's initial, drawn large, so a shop
          // halfway through uploading its logos still looks deliberate.
          <span
            aria-hidden="true"
            className="text-4xl font-black text-[color-mix(in_srgb,var(--pv-ink)_35%,transparent)]"
          >
            {name.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <Image
            src={logo.url}
            alt=""
            width={logo.width}
            height={logo.height}
            sizes="(max-width: 640px) 45vw, 22vw"
            className="max-h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        )}
      </span>

      {/*
        One line, as asked. `truncate` rather than wrapping: a two-line name on
        one card and a one-line name on the next puts the row of cards at
        different heights, which reads as broken rather than as informative.
      */}
      <span className="border-t border-(--pv-line) px-3 py-2.5">
        <span className="block truncate text-sm font-bold">{name}</span>
        <span className="mt-0.5 block text-xs text-(--pv-muted)">
          {productCount} {productCount === 1 ? "item" : "items"}
        </span>
      </span>
    </Link>
  );
}
