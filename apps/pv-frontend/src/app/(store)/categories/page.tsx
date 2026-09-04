import type { Metadata } from "next";
import { listCategoryCards } from "@pv/backend/services/catalogue";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CategoryCard } from "@/components/category-card";

/**
 * Catalogue and settings come from the database, so this renders per request.
 * Prerendering it would freeze the storefront until the next deploy — a product
 * published in the admin must appear immediately.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Categories" };

/**
 * Every category as a card, in one grid rather than a heading per parent with
 * its children as pills beneath it.
 *
 * The nesting communicated less than it cost. A customer scanning for somewhere
 * to start reads pictures, not an outline, and a sub-category was rendered as a
 * smaller, quieter control than its parent despite being just as buyable. The
 * tier is not lost: a card whose category has a parent names it above the title.
 */
export default async function CategoriesPage() {
  const categories = await listCategoryCards();

  return (
    <>
      <Breadcrumbs trail={[{ label: "Categories" }]} />
      <section className="section-space">
        <div className="container-shell">
          <h1 className="section-title">Categories</h1>

          {categories.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
              No categories have been set up yet.
            </p>
          ) : (
            <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {categories.map((category) => (
                <li key={category.id}>
                  <CategoryCard category={category} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
