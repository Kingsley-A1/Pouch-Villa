import { notFound } from "next/navigation";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { AdminHeader } from "@/components/admin-header";
import { ProductAdminForm } from "@/components/product-admin-form";
import { getCollections, getDevices, getProductById } from "@pv/backend/db";
import { toSingle } from "@/lib/utils";
export const dynamic = "force-dynamic";
export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const product = getProductById(Number((await params).id));
  if (!product) notFound();
  const saved = toSingle((await searchParams).saved);
  return (
    <>
      {saved ? (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          <CheckCircle size={20} weight="fill" />
          Product saved and storefront routes revalidated.
        </div>
      ) : null}
      <AdminHeader
        eyebrow="Catalogue record"
        title={`Edit ${product.name}`}
        description="Compatibility is stored as relational data and drives the public device routes."
      />
      <ProductAdminForm product={product} devices={getDevices()} collections={getCollections()} />
    </>
  );
}
