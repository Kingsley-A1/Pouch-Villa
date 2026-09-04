import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/server/session";
import { listAllProducts, type AdminProductSummary } from "@pv/backend/services/products";
import { likeCountsFor } from "@pv/backend/services/likes";
import { ArrowSquareOut, Heart, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

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
              <ProductRow product={product} likeCount={likes.get(product.id) ?? 0} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One product, with its actions on the card rather than behind it.
 *
 * The whole card used to be a single link to the edit screen, which meant the
 * only thing you could do to a product from this page was open it — and the one
 * question staff actually ask here, "what does this look like to a customer",
 * had no answer at all short of typing the URL.
 *
 * The actions are siblings of the title link, never children of it. A control
 * inside an `<a>` is invalid HTML and browsers resolve it by following the link,
 * so a nested "View" button would have opened the editor instead.
 */
function ProductRow({ product, likeCount }: { product: AdminProductSummary; likeCount: number }) {
  const editHref = `/admin/products/${product.id}/edit`;
  const published = product.status === "published";

  return (
    <div className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4 transition-colors hover:border-(--pv-red)">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">
            <Link
              href={editHref}
              className="hover:text-(--pv-red) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)"
            >
              {product.name}
            </Link>
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
          Hidden at zero rather than shown as "0". A column of zeroes tells staff
          nothing they can act on, and reads as a broken feature on a shop that
          has just opened.
        */}
        {likeCount > 0 ? (
          <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-(--pv-muted)">
            <Heart aria-hidden="true" size={16} weight="fill" />
            <span className="tabular-nums">{likeCount}</span>
            <span className="sr-only">{likeCount === 1 ? "like" : "likes"}</span>
          </span>
        ) : null}
      </div>

      {/*
        Full-width targets on a phone and inline from `sm`. The client runs this
        business from a phone (§2), and two 44 px buttons side by side at 360 px
        leave neither enough room for a label.
      */}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-(--pv-line) pt-3">
        <RowAction href={editHref}>
          <PencilSimple aria-hidden="true" size={16} weight="bold" />
          Edit
        </RowAction>

        {/*
          "View" points at the live storefront page, which exists only once the
          product is published — an unpublished slug is a 404, and sending staff
          to one would look like a broken shop rather than an unpublished
          product. So a draft says why the link is not there instead.
        */}
        {published ? (
          <RowAction
            href={`/products/${product.slug}`}
            // A new tab, because this leaves the admin: staff checking how a
            // product looks should not lose the list they were working through.
            external
          >
            <ArrowSquareOut aria-hidden="true" size={16} weight="bold" />
            View
            <span className="sr-only"> {product.name} on the storefront</span>
          </RowAction>
        ) : (
          <span className="inline-flex min-h-11 items-center px-1 text-xs text-(--pv-muted)">
            Publish it to view on the storefront
          </span>
        )}
      </div>
    </div>
  );
}

function RowAction({
  href,
  external = false,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-(--pv-line)",
        "px-4 text-sm font-bold text-(--pv-ink) sm:flex-none",
        "hover:border-(--pv-red) hover:text-(--pv-red)",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
      )}
    >
      {children}
    </Link>
  );
}
