import type { Metadata } from "next";
import { requirePermission } from "@/server/session";
import { listAllCategories } from "@pv/backend/services/categories";
import { listAllBrands } from "@pv/backend/services/brands";
import { CategoryList } from "./category-list";
import { BrandList } from "./brand-list";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Brands & Categories" };

export default async function CategoriesAdminPage() {
  await requirePermission("category.manage");
  const [categories, brands] = await Promise.all([listAllCategories(), listAllBrands()]);

  return (
    <div className="grid gap-10">
      <div>
        <h1 className="text-2xl font-bold">Brands &amp; Categories</h1>
        <p className="mt-1 text-sm text-(--pv-muted)">
          Two tiers of categories organise the storefront; brands are a separate filter that applies
          across every category.
        </p>
      </div>
      <CategoryList categories={categories} />
      <BrandList brands={brands} />
    </div>
  );
}
