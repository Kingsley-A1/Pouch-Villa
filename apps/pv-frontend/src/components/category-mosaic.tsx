import Link from "next/link";
import Image from "next/image";
import type { CategoryCard } from "@pv/backend/services/catalogue";
import { cn } from "@/lib/utils";
import { DeckControls } from "./deck-controls";

const DECK_TRACK_ID = "pv-category-track";

/**
 * The ways into the shop: one category at a time, on every screen.
 *
 * **One presentation, not two.** This used to be a deck on desktop and a stack
 * of cards on a phone, on the reasoning that a slide somebody has to wait out is
 * worse than a list they can scroll past. The client asked for the deck on the
 * phone too, and they are right about their own shop — the categories are the
 * front door, and two of them stacked pushed everything else below the fold.
 *
 * Collapsing the two also removes a real cost that was invisible in a
 * screenshot: both trees were in the HTML at once with CSS choosing between
 * them, so every phone downloaded the markup for a layout it would never show.
 *
 * The deck is the browser's own scroll-snap strip, so on a phone it is a swipe
 * with no JavaScript involved. `DeckControls` adds autoplay, arrows and dots on
 * top, and stops for good the moment somebody touches it — which is what makes
 * this a deck the visitor drives rather than one that moves under them.
 *
 * There is no product count. The client asked for it gone: on a photograph the
 * size of a screen, "5 items" is the smallest true thing that could be said and
 * it was competing with the name.
 */
export function CategoryMosaic({ categories }: { categories: CategoryCard[] }) {
  if (categories.length === 0) return null;
  return <CategoryDeck categories={categories} />;
}

/**
 * One category at a time, taller on a phone and wider on a desktop.
 *
 * The photograph is blurred and darkened a little. That is not decoration — the
 * name sits over the middle of an arbitrary image the CEO uploaded, and there is
 * no other way to keep white text above 4.5:1 on a picture nobody has measured.
 * The blur is slight enough that the product is still legible behind it.
 */
function CategoryDeck({ categories }: { categories: CategoryCard[] }) {
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
              <Link href={`/browse/${category.slug}`} className="pv-cat-cta pv-cta-halo pv-loop">
                Shop Now
              </Link>
            </div>
          </article>
        ))}
      </div>

      {/*
        Four seconds, not two. Two was chosen when this only ran on a desktop,
        where the whole band is taken in at a glance. On a phone the slide is
        most of the screen and there is more to read, so the same cadence reads
        as the page moving on before you are done with it.
      */}
      {categories.length > 1 ? (
        <DeckControls count={categories.length} trackId={DECK_TRACK_ID} intervalMs={4000} />
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
