import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/server/session";
import { getProductForEdit } from "@pv/backend/services/products";
import { listAllBrands } from "@pv/backend/services/brands";
import { listAllCategories } from "@pv/backend/services/categories";
import { listAllDevices } from "@pv/backend/services/devices";
import { listProductMedia } from "@pv/backend/services/media";
import { listCollectionIdsForProduct, listCollections } from "@pv/backend/services/home-sections";
import { isStorageConfigured } from "@pv/backend/storage/r2";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProductForm } from "../../product-form";
import { VariantsSection } from "../../variants-section";
import { MediaSection } from "../../media-section";
import { StatusControl } from "../../status-control";
import { updateProductAction } from "../../actions";
import type { ActionState } from "@/lib/action-state";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductForEdit(id);
  return { title: product ? `Edit ${product.name}` : "Product not found" };
}

export default async function EditProductPage({ params }: Params) {
  await requirePermission("product.manage");
  const { id } = await params;
  const storageConfigured = isStorageConfigured();
  const [product, brands, categories, devices, media, collections, memberOf] = await Promise.all([
    getProductForEdit(id),
    listAllBrands(),
    listAllCategories(),
    listAllDevices(),
    storageConfigured ? listProductMedia(id) : Promise.resolve([]),
    listCollections(),
    listCollectionIdsForProduct(id),
  ]);
  if (product === null) notFound();

  const boundUpdate = updateProductAction.bind(null, id) as (
    prev: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;

  return (
    <div className="grid gap-8">
      <Breadcrumbs
        trail={[{ label: "Products", href: "/admin/products" }, { label: product.name }]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <StatusControl productId={product.id} status={product.status} />
      </div>

      <ProductForm
        action={boundUpdate}
        brands={brands}
        categories={categories}
        devices={devices}
        collections={collections}
        memberOfCollectionIds={memberOf}
        editing={product}
        submitLabel="Save changes"
      />

      <VariantsSection productId={product.id} variants={product.variants} />

      <MediaSection productId={product.id} media={media} storageConfigured={storageConfigured} />
    </div>
  );
}
