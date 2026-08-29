import { AdminHeader } from "@/components/admin-header";
import { ProductAdminForm } from "@/components/product-admin-form";
import { getCollections, getDevices } from "@pv/backend/db";
export const dynamic = "force-dynamic";
export default function NewProductPage() {
  return (
    <>
      <AdminHeader
        eyebrow="New catalogue record"
        title="Create product"
        description="New products begin as drafts. Assign exact device compatibility before publishing."
      />
      <ProductAdminForm devices={getDevices()} collections={getCollections()} />
    </>
  );
}
