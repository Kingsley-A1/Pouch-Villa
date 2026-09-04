import Link from "next/link";
import Image from "next/image";
import {
  listPublishedProducts,
  listTopCategoryCards,
  listDevices,
} from "@pv/backend/services/catalogue";
import { listHomeSections } from "@pv/backend/services/home-sections";
import { pick, readSettings } from "@pv/backend/services/settings";
import { CategoryCard } from "@/components/category-card";
import { ProductGrid } from "@/components/product-grid";
import { StorefrontSection } from "@/components/storefront-section";
import { DeviceFinder } from "@/components/device-finder";
import { AwaitingConfirmation } from "@/components/awaiting-confirmation";
import { likeSummaryFor } from "@/server/product-likes";

/**
 * Catalogue and settings come from the database, so this renders per request.
 * Prerendering it would freeze the storefront until the next deploy — a product
 * published in the admin must appear immediately.
 */
export const dynamic = "force-dynamic";

/**
 * The shop's own pitch, used until the CEO writes their own in Settings.
 *
 * A default is safe here in a way a default phone number never would be: §4's
 * rule protects facts that are *wrong* if invented, and there is no truth about
 * the business for a headline to contradict. The page must still say something
 * above the fold on the day it launches.
 *
 * There is no default subtitle any more. The client's note on this review was
 * that the home page carries too much text, and a second sentence nobody wrote
 * is the easiest one to lose: a supporting line is worth reading when the CEO
 * has something to say, and is filler when it is ours.
 */
const DEFAULT_HEADLINE = "Pouches and gadget accessories that fit your phone.";

export default async function HomePage() {
  const [{ products: latest }, categories, devices, sections, settings] = await Promise.all([
    listPublishedProducts({ limit: 8 }),
    listTopCategoryCards(),
    listDevices(),
    listHomeSections(),
    readSettings([
      "store.address",
      "store.opening_hours",
      "store.hero_headline",
      "store.hero_subtitle",
    ]),
  ]);

  const address = pick(settings, "store.address");
  const hours = pick(settings, "store.opening_hours");
  const headline = pick(settings, "store.hero_headline");
  const subtitle = pick(settings, "store.hero_subtitle");

  /**
   * "Latest" is the fallback, not a fixture. Once the CEO has arranged the home
   * page it would only repeat products the sections above already show, so it
   * steps aside — the shop is theirs to arrange, not ours.
   */
  const showLatest = sections.length === 0;

  // One like lookup for every product on the page, however many sections it
  // spans. A query per section would be an N+1 on the busiest page in the shop.
  const shown = showLatest ? latest : sections.flatMap((section) => section.products);
  const likes = await likeSummaryFor(dedupeById(shown));

  return (
    <>
      {/*
        The opening line, set in the display sans at display scale.

        `hero-space` rather than `section-space`: the section rhythm is right
        between two sections and too generous directly under the header, where it
        left a band of empty page above the first words on the site.

        Cut back on the client's review. It carried an eyebrow, a headline, a
        supporting sentence and two buttons before the first useful control, and
        on a 360 px screen that was the whole of the first view spent on prose.
        What is left is the headline, whatever the CEO chose to add to it, and
        the one thing a shopper actually came to do.

        The staggered entrance is applied to the text only, and the delays are
        utility classes rather than inline `style` attributes — a `style` attr
        needs `style-src-attr 'unsafe-inline'`, which §5 rules out.
      */}
      <section className="hero-space">
        <div className="container-shell">
          <h1 className="hero-title rise-in sm:max-w-[34ch]">
            {headline.present ? headline.value : DEFAULT_HEADLINE}
          </h1>
          {subtitle.present ? (
            <p className="rise-in mt-5 max-w-2xl text-lg leading-8 text-(--pv-muted) [animation-delay:90ms]">
              {subtitle.value}
            </p>
          ) : null}

          {/*
            The two ways into the shop, side by side, directly under the opening
            line — the first thing a customer is asked to choose, before anything
            else competes for the tap.

            `grid-cols-2` at every width, so they stay on one line at 360 px.
            Two cards is the point: each one is a whole half of the catalogue,
            and giving them a full row each would push the finder below the fold
            on the phones this shop is actually used on.

            Only top-level categories. A sub-category standing beside its own
            parent would make "which way in" unanswerable, which is the one
            question this row exists to ask.
          */}
          {categories.length > 0 ? (
            <ul className="rise-in mt-9 grid grid-cols-2 gap-3 [animation-delay:150ms] sm:max-w-2xl sm:gap-4">
              {categories.map((category) => (
                <li key={category.id}>
                  <CategoryCard category={category} href={`/browse/${category.slug}`} />
                </li>
              ))}
            </ul>
          ) : null}

          {/*
            The finder sits under them, as the shortcut for somebody who already
            knows their phone and does not want to browse at all.

            It renders nothing until staff have entered a device, so where the
            shop has none the plain way into the catalogue takes its place rather
            than leaving the hero with no way forward.
          */}
          <div className="rise-in mt-8 max-w-md [animation-delay:230ms]">
            {devices.length > 0 ? (
              <DeviceFinder devices={devices} />
            ) : (
              <Link href="/shop" className="button-primary">
                Shop the range
              </Link>
            )}
          </div>

          <Link
            href="/shop"
            className="rise-in mt-4 inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4 [animation-delay:300ms]"
          >
            Or browse everything
          </Link>
        </div>
      </section>

      {sections.map((section, position) => (
        <StorefrontSection key={section.id} section={section} likes={likes} index={position} />
      ))}

      {showLatest ? (
        <section className="band-raised section-space">
          <div className="container-shell">
            <h2 className="section-title">Latest</h2>
            <div className="mt-6">
              <ProductGrid
                products={latest}
                likes={likes}
                emptyMessage="The catalogue is being set up. Products appear here once staff publish them."
              />
            </div>
          </div>
        </section>
      ) : null}

      {/*
        A real photo beside the address, rather than the address on its own.
        An unfamiliar name and a street address are abstract; what the door
        actually looks like is what someone glances at from a bike or a bus to
        confirm they have arrived. `fill` is right here — unlike the About
        photo, this box has a shape of its own (`aspect-video`) that the source
        image is cropped to fit, rather than the image dictating the box.
      */}
      <section className="band-deep section-space">
        <div className="container-shell grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="relative aspect-video overflow-hidden rounded-3xl bg-(--pv-surface)">
            <Image
              src="/images/storefront-display-wall.jpg"
              alt="Phone cases and pouches on display inside Pouch Villa."
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-lg font-bold">Store address</h2>
              {address.present ? (
                <p className="mt-2 text-(--pv-muted)">{address.value}</p>
              ) : (
                <AwaitingConfirmation what="store address" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold">Opening hours</h2>
              {hours.present ? (
                <p className="mt-2 text-(--pv-muted)">{hours.value}</p>
              ) : (
                <AwaitingConfirmation what="opening hours" />
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * A product may appear in more than one section — it can be in a category
 * section and hand-picked into a collection. Asking for its like count twice
 * would be wasted work and, worse, is what makes an `ANY($1)` parameter grow
 * without bound as sections are added.
 */
function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) if (!seen.has(item.id)) seen.set(item.id, item);
  return [...seen.values()];
}
