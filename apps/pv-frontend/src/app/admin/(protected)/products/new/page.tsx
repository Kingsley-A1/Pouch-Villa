import type { Metadata } from "next";
import { requirePermission } from "@/server/session";
import { listAllBrands } from "@pv/backend/services/brands";
import { listAllCategories } from "@pv/backend/services/categories";
import { listAllDevices } from "@pv/backend/services/devices";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { createProductAction } from "../actions";
import { CreateProduct } from "./create-product";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requirePermission("product.manage");
  const [brands, categories, devices] = await Promise.all([
    listAllBrands(),
    listAllCategories(),
    listAllDevices(),
  ]);

  return (
    <div className="grid gap-6">
      <Breadcrumbs trail={[{ label: "Products", href: "/admin/products" }, { label: "New" }]} />
      <h1 className="text-2xl font-bold">New product</h1>
      <CreateProduct
        action={createProductAction}
        brands={brands}
        categories={categories}
        devices={devices}
      />
    </div>
  );
}
