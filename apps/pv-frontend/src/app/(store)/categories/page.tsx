import type { Metadata } from "next";
import Link from "next/link";
import { listCategoryTree } from "@pv/backend/services/catalogue";
import { Breadcrumbs } from "@/components/breadcrumbs";

/**
 * Catalogue and settings come from the database, so this renders per request.
 * Prerendering it would freeze the storefront until the next deploy — a product
 * published in the admin must appear immediately.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await listCategoryTree();

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
            <div className="mt-8 grid gap-8">
              {categories.map((parent) => (
                <div key={parent.id}>
                  <h2 className="text-lg font-bold">
                    <Link href={`/shop?category=${parent.slug}`}>{parent.name}</Link>
                  </h2>
                  {parent.description ? (
                    <p className="mt-1 text-sm text-(--pv-muted)">{parent.description}</p>
                  ) : null}
                  {parent.children.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {parent.children.map((child) => (
                        <li key={child.id}>
                          <Link
                            href={`/shop?category=${child.slug}`}
                            className="inline-flex min-h-11 items-center rounded-full border border-(--pv-line) px-4 text-sm font-semibold"
                          >
                            {child.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
