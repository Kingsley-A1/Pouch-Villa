import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import {
  getBrandBySlug,
  getCategoryBySlug,
  listDevicesInCategoryForBrand,
} from "@pv/backend/services/catalogue";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ChoiceTile } from "@/components/choice-tile";
import { InstantFilter } from "@/components/instant-filter";

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
 * Step three: the category and the make are settled, now the model.
 *
 * This used to ask for the *kind* — luxury, protective — from the child
 * categories. The CEO's own description of the path is the reason it now asks
 * which phone: having picked Pouches and then Apple, the question a shopper is
 * holding is "which iPhone have I got", and answering it is what makes the
 * result a shelf of things that actually fit. The kinds are still reachable, as
 * filters on the results themselves.
 *
 * **Where there is only one model, or none, this page does not exist.** It
 * redirects straight to the results. A screen that asks a question with one
 * answer is a tap taken from somebody for nothing, and the whole point of the
 * path is that every step narrows something.
 *
 * The models come from the `device` table, which staff fill in at
 * `/admin/devices`. Where the shop has entered none, every brand redirects and
 * the path is two steps rather than three — correct behaviour rather than a
 * broken screen, and it becomes three the day the models are entered.
 */
export default async function BrowseBrandPage({ params }: Params) {
  const { category: categorySlug, brand: brandSlug } = await params;

  const [category, brand] = await Promise.all([
    getCategoryBySlug(categorySlug),
    getBrandBySlug(brandSlug),
  ]);
  if (category === null || brand === null) notFound();

  const models = await listDevicesInCategoryForBrand(categorySlug, brandSlug);
  const results = `/shop?category=${category.slug}&brand=${brand.slug}`;

  if (models.length <= 1) {
    // One model is not a choice, and none means the shop has not recorded any
    // for this make. Either way the answer is the products themselves.
    redirect(
      models[0] === undefined
        ? results
        : `/shop?category=${category.slug}&device=${models[0].slug}`,
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
          <h1 className="section-title mt-2">Which {brand.name}?</h1>
          <p className="mt-3 max-w-2xl text-(--pv-muted)">
            Pick your model and we will show only what fits it.
          </p>

          {/*
            A make can carry a lot of models — more than the brand list ever
            will — so the filter is worth offering sooner here.
          */}
          {models.length > 6 ? (
            <InstantFilter
              scope="models"
              total={models.length}
              label="Find your model"
              placeholder="Start typing — 15 Pro, A54…"
            />
          ) : null}

          <ul
            data-filter-scope="models"
            className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          >
            {models.map((model) => (
              <li key={model.id} data-filter-label={`${brand.name} ${model.name}`}>
                <ChoiceTile
                  href={`/shop?category=${category.slug}&device=${model.slug}`}
                  title={model.name}
                  detail={`${model.productCount} ${model.productCount === 1 ? "item" : "items"}`}
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
