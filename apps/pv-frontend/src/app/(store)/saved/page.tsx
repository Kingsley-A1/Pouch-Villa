import { Breadcrumbs } from "@/components/breadcrumbs";
import { SavedProducts } from "@/components/saved-products";
import { getProducts } from "@pv/backend/db";
export const dynamic = "force-dynamic";
export default function SavedPage() {
  return (
    <>
      <Breadcrumbs trail={[{ label: "Saved products" }]} />
      <section className="section-space">
        <div className="container-shell">
          <p className="eyebrow">Stored on this device</p>
          <h1 className="section-title mt-3 mb-10">Saved products</h1>
          <SavedProducts products={getProducts()} />
        </div>
      </section>
    </>
  );
}
