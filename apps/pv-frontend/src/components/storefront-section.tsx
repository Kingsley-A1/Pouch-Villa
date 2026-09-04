import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { HomeSection } from "@pv/backend/services/home-sections";
import type { LikeSummary } from "@/server/product-likes";
import { ProductCard } from "@/components/product-card";
import { ProductGrid } from "@/components/product-grid";
import { cn } from "@/lib/utils";

/**
 * One home-page section, drawn in whichever of the three treatments the CEO
 * chose for it. The treatment is a column on the row, not a decision made here —
 * see `migrations/0010_section_layout.sql`.
 *
 * All three are Server Components and ship no JavaScript of their own. The only
 * client island anywhere below is the heart on a card, and only when the page
 * supplies like state.
 */

/**
 * "See all" only where there is more to see.
 *
 * A rule-driven section shows the newest few of what matches, so the rest are a
 * click away. A hand-picked collection is complete by definition, and a link
 * leading to the whole shop would misdescribe itself.
 */
function BrowseLink({ section, className }: { section: HomeSection; className?: string }) {
  if (section.browseHref === null) return null;
  return (
    <Link
      href={section.browseHref}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-(--pv-red)",
        "hover:gap-2.5 motion-reduce:hover:gap-1.5",
        "transition-[gap] duration-200 motion-reduce:transition-none",
        className,
      )}
    >
      See all
      <span className="sr-only"> {section.title}</span>
      <ArrowRight aria-hidden="true" size={16} weight="bold" />
    </Link>
  );
}

/**
 * Sections alternate their ground so a page of them has a beat.
 *
 * The client asked for the shop to be red without every section being the same
 * flat red — one unbroken field of a saturated colour reads as a wall rather
 * than a shop. The alternation is a depth change inside the brand, not a second
 * hue, and it comes from position rather than from a per-section setting: the
 * CEO arranges what a section *is*, and the page decides how it sits.
 */
export function StorefrontSection({
  section,
  likes,
  index = 0,
}: {
  section: HomeSection;
  likes: LikeSummary;
  /** Position on the page. Odd-numbered sections lift onto a raised band. */
  index?: number;
}) {
  const tone = index % 2 === 1 ? "band-raised" : "";
  if (section.layout === "feature")
    return <FeatureSection section={section} likes={likes} tone={tone} />;
  if (section.layout === "band") return <BandSection section={section} likes={likes} tone={tone} />;
  return <GridSection section={section} likes={likes} tone={tone} />;
}

type SectionProps = { section: HomeSection; likes: LikeSummary; tone: string };

/** The default. Heading above, even grid below. */
function GridSection({ section, likes, tone }: SectionProps) {
  return (
    <section className={cn("section-space", tone)}>
      <div className="container-shell">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="section-title">{section.title}</h2>
            {section.subtitle ? (
              <p className="mt-2 max-w-xl text-(--pv-muted)">{section.subtitle}</p>
            ) : null}
          </div>
          <BrowseLink section={section} className="self-center" />
        </div>
        <div className="mt-6">
          <ProductGrid products={section.products} likes={likes} />
        </div>
      </div>
    </section>
  );
}

/**
 * Editorial. The first product leads at double width and the rest fill beside
 * it, so the section has a focal point instead of an even wall of cards.
 *
 * Below `md` the asymmetry is dropped entirely and it becomes an ordinary
 * two-column grid: a "lead" tile only reads as a lead when something sits
 * beside it, and on a 360px screen nothing does.
 */
function FeatureSection({ section, likes, tone }: SectionProps) {
  const [lead, ...rest] = section.products;
  if (lead === undefined) return null;
  const leadLike = likes.get(lead.id);

  return (
    <section className={cn("section-space", tone)}>
      <div className="container-shell">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            {/* The display serif, borrowed from the hero, is what separates this
                treatment from the plain grid before a single card is read. */}
            <h2 className="display-title text-[clamp(1.9rem,3.4vw,2.9rem)]">{section.title}</h2>
            {section.subtitle ? (
              <p className="mt-3 leading-relaxed text-(--pv-muted)">{section.subtitle}</p>
            ) : null}
          </div>
          <BrowseLink section={section} />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="col-span-2 md:row-span-2">
            <ProductCard product={lead} size="feature" {...(leadLike ? { like: leadLike } : {})} />
          </div>
          {rest.map((product) => {
            const like = likes.get(product.id);
            return <ProductCard key={product.id} product={product} {...(like ? { like } : {})} />;
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * A tinted full-bleed band with the heading in its own column.
 *
 * Two jobs: it suits a broad, utilitarian range where no single product should
 * lead, and it breaks up a page that would otherwise be an unbroken run of white
 * sections. The heading column sticks on desktop so it stays with the products
 * as they scroll past.
 */
function BandSection({ section, likes, tone }: SectionProps) {
  return (
    // A band already sets its own ground, so it takes the alternation as a
    // second step deeper rather than as a class that would fight it.
    <section
      className={cn("py-14 md:py-20", tone === "" ? "bg-(--pv-wash)" : "bg-(--pv-surface-raised)")}
    >
      <div className="container-shell grid gap-8 lg:grid-cols-[minmax(0,17rem)_1fr] lg:gap-12">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <span aria-hidden="true" className="block h-1 w-12 rounded-full bg-(--pv-red)" />
          <h2 className="section-title mt-5">{section.title}</h2>
          {section.subtitle ? (
            <p className="mt-3 leading-relaxed text-(--pv-muted)">{section.subtitle}</p>
          ) : null}
          <BrowseLink section={section} className="mt-4" />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {section.products.map((product) => {
            const like = likes.get(product.id);
            return <ProductCard key={product.id} product={product} {...(like ? { like } : {})} />;
          })}
        </div>
      </div>
    </section>
  );
}
