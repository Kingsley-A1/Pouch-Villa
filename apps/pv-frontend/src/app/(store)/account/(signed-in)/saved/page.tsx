import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listLikedProducts } from "@pv/backend/services/likes";
import { getCustomerPrincipal } from "@/server/customer-session";
import { likeSummaryFor } from "@/server/product-likes";
import { ProductGrid } from "@/components/product-grid";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Saved products" };

/**
 * What this customer has liked.
 *
 * Only published products come back, so a saved item that has since been
 * unpublished quietly disappears rather than linking to a 404. The count is not
 * announced anywhere here — the grid either has items or says it does not.
 */
export default async function SavedPage() {
  const principal = await getCustomerPrincipal();
  if (principal === null) notFound();

  const products = await listLikedProducts(principal.customerId);
  const likes = await likeSummaryFor(products);

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-(--pv-line) p-8 text-center">
        <p className="text-(--pv-muted)">
          Nothing saved yet. Tap the heart on a product to keep it here.
        </p>
        <Link href="/shop" className="button-primary mt-5 inline-flex">
          Browse the shop
        </Link>
      </div>
    );
  }

  return <ProductGrid products={products} likes={likes} />;
}
