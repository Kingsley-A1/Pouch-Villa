import Link from "next/link";
import Image from "next/image";
import type { CategoryCard } from "@pv/backend/services/catalogue";
import { cn } from "@/lib/utils";
import { DeckControls } from "./deck-controls";

const DECK_TRACK_ID = "pv-category-track";

/**
 * The ways into the shop.
 *
 * **Two presentations, not one responsive layout.** On a desktop the client
 * asked for a full-bleed deck that moves on its own — one category at a time,
 * its name over the middle of the photograph and a square button under it. On a
 * phone that would be a single enormous tile the visitor has to wait out, so
 * below `lg` this stays the stack of cards it already was.
 *
 * Both read the same rows, so the shop is never showing two different sets of
 * categories depending on what you opened it on. The desktop track is a Server
 * Component like the hero's, with one shared controls island for autoplay.
 *
 * There is no product count on either. The client asked for it gone: on a
 * photograph the size of a screen, "5 items" is the smallest true thing that
 * could be said and it was competing with the name.
 */
export function CategoryMosaic({ categories }: { categories: CategoryCard[] }) {
  if (categories.length === 0) return null;

  return (
    <>
      <div className="container-shell lg:hidden">
        <MobileStack categories={categories} />
      </div>
      <div className="hidden lg:block">
        <DesktopDeck categories={categories} />
      </div>
    </>
  );
}

/** Unchanged from what shipped: a stack of square cards, one per category. */
function MobileStack({ categories }: { categories: CategoryCard[] }) {
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {categories.map((category) => (
        <li key={category.id}>
          <Link
            href={`/browse/${category.slug}`}
            className={cn(
              "group relative block aspect-square overflow-hidden rounded-none bg-(--pv-surface)",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-focus)",
            )}
          >
            <Art category={category} sizes="(max-width: 640px) 100vw, 50vw" />
            <span className="absolute bottom-0 left-0 max-w-[92%] bg-[color-mix(in_srgb,#1a0d0e_82%,transparent)] px-3.5 py-2.5">
              <span className="block text-sm font-bold tracking-[0.05em] text-white uppercase">
                {category.name}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Desktop: one category at a time, full width.
 *
 * The photograph is blurred and darkened a little. That is not decoration — the
 * name sits over the middle of an arbitrary image the CEO uploaded, and there is
 * no other way to keep white text above 4.5:1 on a picture nobody has measured.
 * The blur is slight enough that the product is still legible behind it.
 */
function DesktopDeck({ categories }: { categories: CategoryCard[] }) {
  return (
    <section className="relative" aria-roledescription="carousel" aria-label="Shop by category">
      <div id={DECK_TRACK_ID} className="pv-deck-track">
        {categories.map((category, index) => (
          <article
            key={category.id}
            className={cn("pv-cat-slide", index === 0 && "is-on")}
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${categories.length}`}
          >
            <Art category={category} sizes="100vw" className="pv-cat-photo" />

            <div className="pv-cat-body">
              {/* The name arrives first, then the button — the order the client
                  described, and the order somebody reads them in anyway. */}
              <p className="pv-cat-title">{category.name}</p>
              <Link href={`/browse/${category.slug}`} className="pv-cat-cta">
                Shop Now
              </Link>
            </div>
          </article>
        ))}
      </div>

      {categories.length > 1 ? (
        <DeckControls count={categories.length} trackId={DECK_TRACK_ID} intervalMs={2000} />
      ) : null}
    </section>
  );
}

/**
 * The picture, or a lettered panel where the CEO has not set one.
 *
 * Shared so the two presentations cannot drift into showing different artwork —
 * and so the fallback for an unphotographed category is written once.
 */
function Art({
  category,
  sizes,
  className,
}: {
  category: CategoryCard;
  sizes: string;
  className?: string;
}) {
  if (category.image === null) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "grid h-full w-full place-items-center bg-(--pv-wash) text-6xl font-black",
          "text-[color-mix(in_srgb,var(--pv-ink)_22%,transparent)]",
          className,
        )}
      >
        {category.name.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <Image
      src={category.image.cardUrl}
      alt=""
      fill
      sizes={sizes}
      /*
        Lazy, and never `priority`, in both presentations.

        Both the stack and the deck are in the HTML at once — CSS decides which
        one a visitor sees — so an eager image here would make a phone download
        the desktop deck's 100vw photograph it will never display. Lazy loading
        is what keeps the hidden half free: a browser does not fetch a lazy image
        inside a `display: none` subtree.

        Neither is the LCP element either way; the band sits below the headline.
      */
      loading="lazy"
      className={cn(
        "object-cover transition-transform duration-500 group-hover:scale-[1.06]",
        "motion-reduce:transition-none motion-reduce:group-hover:scale-100",
        className,
      )}
    />
  );
}
