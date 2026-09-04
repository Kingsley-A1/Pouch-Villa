import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import {
  getBrandBySlug,
  getCategoryBySlug,
  listChildCategoriesForBrand,
} from "@pv/backend/services/catalogue";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ChoiceTile } from "@/components/choice-tile";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ category: string; brand: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { category: categorySlug, brand: brandSlug } = await params;
  const [category, brand] = await Promise.all([
    getCategoryBySlug(categorySlug),
    getBrandBySlug(brandSlug),
  ]);
  if (category === null || brand === null) return { title: "Not found" };
  return { title: `${brand.name} ${category.name}` };
}

/**
 * Step three: the category and the brand are settled, now the kind — luxury,
 * protective, whatever the shop has filed under this category.
 *
 * **Where there is only one kind, or none, this page does not exist.** It
 * redirects straight to the results. A screen that asks a question with one
 * answer is a tap taken from somebody for nothing, and the whole point of the
 * path is that every step narrows something.
 */
export default async function BrowseBrandPage({ params }: Params) {
  const { category: categorySlug, brand: brandSlug } = await params;

  const [category, brand] = await Promise.all([
    getCategoryBySlug(categorySlug),
    getBrandBySlug(brandSlug),
  ]);
  if (category === null || brand === null) notFound();

  const kinds = await listChildCategoriesForBrand(categorySlug, brandSlug);
  const results = `/shop?category=${category.slug}&brand=${brand.slug}`;

  if (kinds.length <= 1) {
    // One kind is not a choice, and none means this brand's stock sits directly
    // on the parent. Either way the answer is the products themselves.
    redirect(
      kinds[0] === undefined ? results : `/shop?category=${kinds[0].slug}&brand=${brand.slug}`,
    );
  }

  return (
    <>
      <Breadcrumbs
        trail={[{ label: category.name, href: `/browse/${category.slug}` }, { label: brand.name }]}
      />
      <section className="section-space">
        <div className="container-shell">
          <p className="eyebrow">Step 2 of 2</p>
          <h1 className="section-title mt-2">What kind of {singular(category.name)}?</h1>
          <p className="mt-3 max-w-2xl text-(--pv-muted)">
            Showing what we carry for {brand.name}.
          </p>

          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {kinds.map((kind) => (
              <li key={kind.id}>
                <ChoiceTile
                  href={`/shop?category=${kind.slug}&brand=${brand.slug}`}
                  title={kind.name}
                  detail={`${kind.productCount} ${kind.productCount === 1 ? "item" : "items"}`}
                />
              </li>
            ))}
          </ul>

          <Link
            href={results}
            className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-bold underline underline-offset-4"
          >
            Show all {brand.name} {category.name.toLowerCase()}
            <ArrowRight aria-hidden="true" size={15} weight="bold" />
          </Link>
        </div>
      </section>
    </>
  );
}

/**
 * "Pouches" reads badly in "what kind of Pouches?". Trims one trailing `s`,
 * which is right for the categories this shop has and wrong for none of them —
 * and if it ever is wrong, the heading is slightly off rather than broken.
 */
function singular(name: string): string {
  const lower = name.toLowerCase();
  return lower.endsWith("s") ? lower.slice(0, -1) : lower;
}
