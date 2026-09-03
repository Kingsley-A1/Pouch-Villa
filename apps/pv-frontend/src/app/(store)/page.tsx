import Link from "next/link";
import {
  listPublishedProducts,
  listCategoryTree,
  listDevices,
} from "@pv/backend/services/catalogue";
import { listHomeSections } from "@pv/backend/services/home-sections";
import { pick, readSettings } from "@pv/backend/services/settings";
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
 */
const DEFAULT_HEADLINE = "Great pouches and gadget accessories, exactly when you want them.";
const DEFAULT_SUBTITLE = "Browse the range, pick your options, and order with payment by transfer.";

export default async function HomePage() {
  const [{ products: latest }, categories, devices, sections, settings] = await Promise.all([
    listPublishedProducts({ limit: 8 }),
    listCategoryTree(),
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
        The opening line, set in the brand serif at display scale.
        
        The staggered entrance is applied to the text only, and the delays are
        utility classes rather than inline `style` attributes — a `style` attr
        needs `style-src-attr 'unsafe-inline'`, which §5 rules out.
      */}
      <section className="section-space">
        <div className="container-shell">
          <p className="eyebrow rise-in">Welcome to Pouch Villa</p>
          <h1 className="hero-title rise-in mt-4 max-w-[24ch] [animation-delay:90ms] sm:max-w-[34ch]">
            {headline.present ? headline.value : DEFAULT_HEADLINE}
          </h1>
          <p className="rise-in mt-6 max-w-2xl text-lg leading-8 text-(--pv-muted) [animation-delay:180ms]">
            {subtitle.present ? subtitle.value : DEFAULT_SUBTITLE}
          </p>
          <div className="rise-in mt-9 flex flex-wrap gap-3 [animation-delay:270ms]">
            <Link href="/shop" className="button-primary">
              Shop the range
            </Link>
            <Link href="/categories" className="button-ghost">
              Browse categories
            </Link>
          </div>

          {/*
            The finder sits in the hero because it is the shortest path from
            "I need a case" to a page of cases that actually fit. It renders
            nothing until staff have entered a device, so a shop that has not
            been set up yet shows a promise it cannot keep.
          */}
          <div className="rise-in mt-10 max-w-md [animation-delay:340ms]">
            <DeviceFinder devices={devices} />
          </div>
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="section-space">
          <div className="container-shell">
            <h2 className="section-title">Categories</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/shop?category=${category.slug}`}
                    className="flex min-h-11 items-center rounded-xl border border-(--pv-line) px-4 font-semibold"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {sections.map((section) => (
        <StorefrontSection key={section.id} section={section} likes={likes} />
      ))}

      {showLatest ? (
        <section className="section-space">
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

      <section className="section-space">
        <div className="container-shell grid gap-6 sm:grid-cols-2">
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
