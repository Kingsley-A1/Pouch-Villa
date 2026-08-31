import type { Metadata } from "next";
import { requirePermission } from "@/server/session";
import { listAllBrands } from "@pv/backend/services/brands";
import { listAllCategories } from "@pv/backend/services/categories";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProductForm } from "../product-form";
import { createProductAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requirePermission("product.manage");
  const [brands, categories] = await Promise.all([listAllBrands(), listAllCategories()]);

  return (
    <div className="grid gap-6">
      <Breadcrumbs trail={[{ label: "Products", href: "/admin/products" }, { label: "New" }]} />
      <h1 className="text-2xl font-bold">New product</h1>
      <ProductForm
        action={createProductAction}
        brands={brands}
        categories={categories}
        submitLabel="Create product"
      />
    </div>
  );
}
