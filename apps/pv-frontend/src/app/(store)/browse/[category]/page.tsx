import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import {
  getCategoryBySlug,
  listBrandsInCategory,
  listCategoryCards,
  type CategoryCard as StorefrontCategoryCard,
} from "@pv/backend/services/catalogue";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BrandCard } from "@/components/brand-card";
import { CategoryCard } from "@/components/category-card";
import { InstantFilter } from "@/components/instant-filter";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const category = await getCategoryBySlug((await params).category);
  return { title: category === null ? "Not found" : category.name };
}

/**
 * Step two of the browse path: a category has been chosen, now the make.
 *
 * The brands are asked for **inside the category**, not listed globally. This
 * shop's brand table holds phone makers and accessory makers together, and a
 * flat list of all of them offers combinations that do not exist. Scoped to
 * "Pouch" it can only answer with brands that really have pouches, so every card
 * on this screen leads somewhere with something in it.
 *
 * Carried by logos rather than by text tiles, at the client's instruction: two
 * across at 360 px and four on a desktop, the mark held prominently with the
 * name on one line beneath it. The logos are set on the Brands & Categories
 * admin page; a brand without one draws its initial rather than an empty box.
 *
 * "Show everything" is not a fallback, it is a real path. Some products carry no
 * brand at all, and a shopper who only ever sees brand cards could never reach
 * them — a browse path that strands stock is worse than no browse path.
 */
export default async function BrowseCategoryPage({ params }: Params) {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (category === null) notFound();

  /*
    Two sections, two questions.

    A pouch is chosen by the phone it goes on, so the first step is the make. An
    accessory is chosen by what it is — nobody shops for "a power bank for a
    Samsung" — so asking which device it is for sends a buyer down a path that
    answers nothing. That section offers its types instead.

    Which question a section asks is the CEO's setting on the category, never a
    check on its name: AGENTS.md section 4 keeps a category list out of source.
  */
  if (!category.fitsDevices) {
    const types = await listCategoryCards({ parentSlug: slug });
    return <AccessorySection category={category} types={types} />;
  }

  const brands = await listBrandsInCategory(slug);

  return (
    <>
      <Breadcrumbs trail={[{ label: category.name }]} />
      <section className="section-space">
        <div className="container-shell">
          <p className="eyebrow">Step 1 of 2</p>
          <h1 className="section-title mt-2">Which device is it for?</h1>
          <p className="mt-3 max-w-2xl text-(--pv-muted)">
            {brands.length === 0
              ? `Nothing is filed under ${category.name} yet.`
              : `Pick a make and we will show you the ${category.name.toLowerCase()} that fit it.`}
          </p>

          {/*
            The filter only earns its place once the list is long enough to be
            worth narrowing. Below that it is a control that does nothing but
            take up the space above the thing it filters.
          */}
          {brands.length > 6 ? (
            <InstantFilter
              scope="brands"
              total={brands.length}
              label="Find a make"
              placeholder="Start typing — Apple, Samsung…"
            />
          ) : null}

          {brands.length > 0 ? (
            <ul
              data-filter-scope="brands"
              className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            >
              {brands.map((brand) => (
                // The label lives on the cell so that filtering one out removes
                // its whole grid slot rather than leaving a gap where it was.
                <li key={brand.id} data-filter-label={brand.name}>
                  <BrandCard brand={brand} href={`/browse/${category.slug}/${brand.slug}`} />
                </li>
              ))}
            </ul>
          ) : null}

          <Link
            href={`/shop?category=${category.slug}`}
            className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-bold underline underline-offset-4"
          >
            {/* "every pouches" is wrong and "every pouch" is a different claim,
                so the plural takes "all" and reads correctly either way. */}
            Show all {category.name.toLowerCase()} instead
            <ArrowRight aria-hidden="true" size={15} weight="bold" />
          </Link>
        </div>
      </section>
    </>
  );
}

/**
 * A section browsed by type rather than by device.
 *
 * One step, not two: the types *are* the answer, so a buyer taps once and is in
 * the shop filtered to what they wanted. The device path needs a second step
 * because a make alone is not enough to show anything useful.
 *
 * A section with no types yet says so and offers everything in it, rather than
 * rendering an empty grid — the same rule the device classes follow, and §0
 * rule 2: a tier nobody has filled in is not a heading to put in front of a
 * customer.
 */
function AccessorySection({
  category,
  types,
}: {
  category: { slug: string; name: string; description: string | null };
  types: StorefrontCategoryCard[];
}) {
  return (
    <>
      <Breadcrumbs trail={[{ label: category.name }]} />
      <section className="section-space">
        <div className="container-shell">
          <h1 className="section-title">{category.name}</h1>
          <p className="mt-3 max-w-2xl text-(--pv-muted)">
            {types.length === 0
              ? `Everything we have in ${category.name.toLowerCase()}.`
              : "Pick what you are looking for."}
          </p>

          {/* The same threshold the make list uses: a filter above six things is
              a control that costs more space than it saves. */}
          {types.length > 6 ? (
            <InstantFilter
              scope="types"
              total={types.length}
              label="Find a type"
              placeholder="Start typing — cables, power banks…"
            />
          ) : null}

          {types.length > 0 ? (
            <ul
              data-filter-scope="types"
              className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            >
              {types.map((type) => (
                <li key={type.id} data-filter-label={type.name}>
                  <CategoryCard category={type} href={`/shop?category=${type.slug}`} />
                </li>
              ))}
            </ul>
          ) : null}

          <Link
            href={`/shop?category=${category.slug}`}
            className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-bold underline underline-offset-4"
          >
            Show all {category.name.toLowerCase()} instead
            <ArrowRight aria-hidden="true" size={15} weight="bold" />
          </Link>
        </div>
      </section>
    </>
  );
}
