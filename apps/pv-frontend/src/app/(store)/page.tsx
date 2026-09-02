import Link from "next/link";
import { listPublishedProducts, listCategoryTree } from "@pv/backend/services/catalogue";
import { listHomeSections, type HomeSection } from "@pv/backend/services/home-sections";
import { pick, readSettings } from "@pv/backend/services/settings";
import { ProductGrid } from "@/components/product-grid";
import { AwaitingConfirmation } from "@/components/awaiting-confirmation";
import { likeSummaryFor, type LikeSummary } from "@/server/product-likes";

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
  const [{ products: latest }, categories, sections, settings] = await Promise.all([
    listPublishedProducts({ limit: 8 }),
    listCategoryTree(),
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
      <section className="section-space">
        <div className="container-shell">
          <h1 className="section-title">{headline.present ? headline.value : DEFAULT_HEADLINE}</h1>
          <p className="mt-4 max-w-xl leading-7 text-(--pv-muted)">
            {subtitle.present ? subtitle.value : DEFAULT_SUBTITLE}
          </p>
          <Link href="/shop" className="button-primary mt-8 inline-flex">
            Shop the range
          </Link>
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

function StorefrontSection({ section, likes }: { section: HomeSection; likes: LikeSummary }) {
  return (
    <section className="section-space">
      <div className="container-shell">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="section-title">{section.title}</h2>
            {section.subtitle ? (
              <p className="mt-2 max-w-xl text-(--pv-muted)">{section.subtitle}</p>
            ) : null}
          </div>
          {/*
            A rule-driven section can show only its first few products, so it
            offers the rest. A hand-picked collection is complete by definition:
            there is nothing further to see, and a "See all" that led to the
            whole shop would be a lie about what the link does.
          */}
          {section.browseHref ? (
            <Link
              href={section.browseHref}
              className="min-h-11 self-center text-sm font-bold text-(--pv-red) hover:underline"
            >
              See all
              <span className="sr-only"> {section.title}</span>
            </Link>
          ) : null}
        </div>
        <div className="mt-6">
          <ProductGrid products={section.products} likes={likes} />
        </div>
      </div>
    </section>
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
