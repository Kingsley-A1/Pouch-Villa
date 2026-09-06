import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import {
  listPublishedProducts,
  listTopCategoryCards,
  listDevices,
} from "@pv/backend/services/catalogue";
import { listHomeSections } from "@pv/backend/services/home-sections";
import { listHeroSlides } from "@pv/backend/services/hero-slides";
import { pick, readSettings } from "@pv/backend/services/settings";
import { CategoryMosaic } from "@/components/category-mosaic";
import { HeroDeck } from "@/components/hero-deck";
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
  const [{ products: latest }, categories, devices, sections, slides, settings] = await Promise.all(
    [
      listPublishedProducts({ limit: 8 }),
      listTopCategoryCards(),
      listDevices(),
      listHomeSections(),
      listHeroSlides(),
      readSettings([
        "store.address",
        "store.opening_hours",
        "store.hero_headline",
        "store.hero_subtitle",
      ]),
    ],
  );

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
      {/*
        The deck when the CEO has built one, the headline when they have not.

        Not both: two competing openings is what the client's review objected to
        in the first place, and a headline underneath a full-bleed photograph is
        a second hero nobody asked for. `listHeroSlides` already excludes slides
        with no picture, so "has a deck" means "has something worth showing".
      */}
      {slides.length > 0 ? <HeroDeck slides={slides} /> : null}

      {slides.length > 0 ? null : (
        <section className="hero-space">
          {/*
          One centred column, at every width.

          `items-center` rather than `text-center` on the container: it centres
          each block — the headline, the two category cards, the finder, the
          button — as a unit, and leaves the text *inside* them alone. A blanket
          `text-center` would have centred the finder's field labels and the
          product counts on the cards too, which turns a form into a poster.

          Every child that has a `max-w-*` also needs `w-full`, because
          `items-center` makes a flex child shrink to its content rather than
          stretch, and a two-up grid that shrinks to its content is not a
          two-up grid on a 360 px screen.
        */}
          <div className="container-shell flex flex-col items-center">
            <h1 className="hero-title rise-in text-center sm:max-w-[34ch]">
              {headline.present ? headline.value : DEFAULT_HEADLINE}
            </h1>

            {/*
            One way in, not three.

            The finder used to sit here too. It now has its own band under the
            mosaic, and rendering it in both places put two copies of the same
            form on one page — which is a duplicated `id`, a second identical
            heading, and a shopper wondering which of the two is the real one.

            What is left is the plain route into the catalogue, for somebody who
            does not want to answer a question before they can look at anything.
          */}
            <Link href="/shop" className="button-primary rise-in mt-8 [animation-delay:230ms]">
              Shop the range
              <ArrowRight aria-hidden="true" size={16} weight="bold" />
            </Link>
          </div>
        </section>
      )}

      {/*
        The ways in, as photographs rather than as two outlined cards in the
        hero. They moved down out of the hero deliberately: the opening line and
        the finder are what someone needs in the first screenful, and the
        categories read far better with room to be pictures.
      */}
      {categories.length > 0 ? (
        <section className="section-space">
          <div className="container-shell">
            <CategoryMosaic categories={categories} />
          </div>
        </section>
      ) : null}

      {/*
        The finder, directly under the ways in.

        The CEO direction put it here in so many words - the category cards,
        "then the device finder" - and it is the one thing this shop has that
        the reference site does not. The plan had proposed folding it into the
        header search slot instead; that was wrong on a 360 px screen, where two
        selects and a button do not fit into a 76 px bar beside a cart and an
        account icon without becoming unusable.

        It still renders nothing until staff have entered a device, so a shop
        with an empty model list gets no empty control.
      */}
      {devices.length > 0 ? (
        <section className="band-raised section-space">
          {/*
            No heading of its own: `DeviceFinder` already opens with "Find what
            fits your phone", and a section title above it said the same words
            twice — once to a reader and twice to a screen reader.
          */}
          <div className="container-shell grid justify-items-center">
            <div className="w-full max-w-md">
              <DeviceFinder devices={devices} />
            </div>
          </div>
        </section>
      ) : null}

      {/*
        One named product band, centred, with the CEO's own sentence under it —
        the shape the client asked for. It carries whatever they wrote as the
        sub-heading; where they wrote nothing, the heading stands alone rather
        than borrowing a line of ours.
      */}
      {showLatest ? (
        <section className="band-raised section-space">
          <div className="container-shell">
            <div className="text-center">
              <h2 className="section-title">Our products</h2>
              {subtitle.present ? (
                <p className="mx-auto mt-3 max-w-xl text-(--pv-muted)">{subtitle.value}</p>
              ) : null}
            </div>
            <div className="mt-8">
              <ProductGrid
                products={latest}
                likes={likes}
                emptyMessage="The catalogue is being set up. Products appear here once staff publish them."
              />
            </div>
            {latest.length > 0 ? (
              <div className="mt-10 flex justify-center">
                <Link href="/shop" className="button-secondary">
                  View all products
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {sections.map((section, position) => (
        <StorefrontSection key={section.id} section={section} likes={likes} index={position} />
      ))}

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
