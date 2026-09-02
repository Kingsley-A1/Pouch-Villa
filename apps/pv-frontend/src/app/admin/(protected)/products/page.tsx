import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/server/session";
import { listAllProducts } from "@pv/backend/services/products";
import { likeCountsFor } from "@pv/backend/services/likes";
import { Heart } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Products" };

export default async function ProductsAdminPage() {
  await requirePermission("product.view");
  const products = await listAllProducts();
  // One query for the whole list, not one per row.
  const likes = await likeCountsFor(products.map((product) => product.id));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="mt-1 text-sm text-(--pv-muted)">{products.length} total</p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex min-h-11 items-center rounded-xl bg-(--pv-red) px-5 text-sm font-bold text-(--pv-on-brand)"
        >
          Add product
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          No products yet.
        </p>
      ) : (
        <ul className="grid gap-3">
          {products.map((product) => (
            <li key={product.id}>
              <Link
                href={`/admin/products/${product.id}/edit`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4 hover:border-(--pv-red)"
              >
                <div>
                  <p className="font-bold">
                    {product.name}
                    <span className="ml-2 rounded-full bg-(--pv-wash) px-2 py-0.5 text-xs font-bold tracking-wide text-(--pv-muted) uppercase">
                      {product.status}
                    </span>
                  </p>
                  <p className="text-xs text-(--pv-muted)">
                    {product.brandName ?? "No brand"} · {product.variantCount} variant
                    {product.variantCount === 1 ? "" : "s"} · stock {product.inStock}
                  </p>
                </div>

                {/*
                  Hidden at zero rather than shown as "0". A column of zeroes
                  tells staff nothing they can act on, and reads as a broken
                  feature on a shop that has just opened.
                */}
                {(likes.get(product.id) ?? 0) > 0 ? (
                  <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-(--pv-muted)">
                    <Heart aria-hidden="true" size={16} weight="fill" />
                    <span className="tabular-nums">{likes.get(product.id)}</span>
                    <span className="sr-only">
                      {likes.get(product.id) === 1 ? "like" : "likes"}
                    </span>
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
