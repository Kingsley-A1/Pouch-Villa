import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { getCategoryBySlug, listBrandsInCategory } from "@pv/backend/services/catalogue";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ChoiceTile } from "@/components/choice-tile";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const category = await getCategoryBySlug((await params).category);
  return { title: category === null ? "Not found" : category.name };
}

/**
 * Step two of the browse path: a category has been chosen, now the brand.
 *
 * The brands are asked for **inside the category**, not listed globally. This
 * shop's brand table holds phone makers and accessory makers together, and a
 * flat list of all of them offers combinations that do not exist. Scoped to
 * "Pouch" it can only answer with brands that really have pouches, so every tile
 * on this screen leads somewhere with something in it.
 *
 * "Show everything" is not a fallback, it is a real path. Some products carry no
 * brand at all, and a shopper who only ever sees brand tiles could never reach
 * them — a browse path that strands stock is worse than no browse path.
 */
export default async function BrowseCategoryPage({ params }: Params) {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (category === null) notFound();

  const brands = await listBrandsInCategory(slug);

  return (
    <>
      <Breadcrumbs trail={[{ label: category.name }]} />
      <section className="section-space">
        <div className="container-shell">
          <p className="eyebrow">Step 1 of 2</p>
          <h1 className="section-title mt-2">Which phone is it for?</h1>
          <p className="mt-3 max-w-2xl text-(--pv-muted)">
            {brands.length === 0
              ? `Nothing is filed under ${category.name} yet.`
              : `Pick a make and we will show you the ${category.name.toLowerCase()} that fit it.`}
          </p>

          {brands.length > 0 ? (
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {brands.map((brand) => (
                <li key={brand.id}>
                  <ChoiceTile
                    href={`/browse/${category.slug}/${brand.slug}`}
                    title={brand.name}
                    detail={`${brand.productCount} ${brand.productCount === 1 ? "item" : "items"}`}
                  />
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
