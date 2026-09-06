import Link from "next/link";
import Image from "next/image";
import type { CategoryCard } from "@pv/backend/services/catalogue";
import { cn } from "@/lib/utils";

/**
 * The ways into the shop, as a bento of photographs.
 *
 * This replaces the two bordered cards that used to sit under the headline. The
 * client's brief was that the home page should be bold, and a two-up grid of
 * outlined cards cannot be made bold — it has to become something else. What
 * carries it is the photography: full-bleed tiles with the name on a plate in
 * the corner, which is the shape of the reference the client pointed at.
 *
 * **The first tile is tall, and only above 720 px.** On a phone the layout is a
 * single column of squares, because a tall tile at 360 px is most of a screen
 * spent on one category. The grid is written so a fourth or a sixth category
 * wraps without anyone having to come back and re-tune it.
 *
 * The label sits on a **solid** plate rather than a gradient. Every other
 * surface in the shop is measured against a known token; this one is measured
 * against whatever photograph the CEO uploaded, and the only way to keep white
 * text at AA over an unknown image is to put something opaque behind it.
 */
export function CategoryMosaic({ categories }: { categories: CategoryCard[] }) {
  if (categories.length === 0) return null;

  return (
    <ul className="mosaic grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category, index) => (
        <li
          key={category.id}
          className={cn(
            // The lead tile spans two rows, so it needs the two-row grid to
            // exist — which it only does from `lg` up.
            index === 0 ? "lg:row-span-2" : undefined,
          )}
        >
          <Tile category={category} lead={index === 0} />
        </li>
      ))}
    </ul>
  );
}

function Tile({ category, lead }: { category: CategoryCard; lead: boolean }) {
  const { image, name, slug, productCount } = category;

  return (
    <Link
      href={`/browse/${slug}`}
      className={cn(
        "group relative block h-full overflow-hidden rounded-none bg-(--pv-surface)",
        // Portrait for the lead where it has the height to fill, landscape
        // otherwise. `aspect-square` on a phone keeps every tile the same shape
        // whichever position it happens to land in.
        "aspect-square",
        lead ? "lg:aspect-3/4" : "lg:aspect-4/3",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-focus)",
      )}
    >
      {image === null ? (
        // A tinted panel with the initial, not an empty grey box: a category
        // nobody has photographed yet should look unfinished, not broken.
        <span
          aria-hidden="true"
          className="grid h-full place-items-center bg-(--pv-wash) text-6xl font-black text-[color-mix(in_srgb,var(--pv-ink)_22%,transparent)]"
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      ) : (
        <Image
          src={image.cardUrl}
          alt=""
          fill
          // The lead tile is the widest thing on the page below `lg`, so it gets
          // its own hint rather than sharing the smaller tiles' estimate.
          sizes={lead ? "(max-width: 1024px) 100vw, 40vw" : "(max-width: 640px) 100vw, 30vw"}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      )}

      <span className="absolute bottom-0 left-0 max-w-[92%] bg-[color-mix(in_srgb,#1a0d0e_82%,transparent)] px-3.5 py-2.5">
        <span className="block text-sm font-bold tracking-[0.05em] text-white uppercase">
          {name}
        </span>
        <span className="mt-0.5 block text-xs text-white/70">
          {productCount} {productCount === 1 ? "item" : "items"}
        </span>
      </span>
    </Link>
  );
}
