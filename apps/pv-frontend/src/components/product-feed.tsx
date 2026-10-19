"use client";

import { useEffect, useRef, useState } from "react";
import type { CatalogueListItem } from "@pv/backend/services/catalogue";
import { ProductGrid } from "@/components/product-grid";

type LikeState = { count: number; liked: boolean };

type Page = {
  products: CatalogueListItem[];
  nextCursor: string | null;
  total: number;
  likes: Record<string, LikeState>;
};

type ApiResponse = { ok: true; data: Page } | { ok: false; error: { message: string } };

/**
 * A product list that keeps going until it has shown everything.
 *
 * The page renders the first screenful on the server and this asks
 * `/api/v1/products` for each page after it. A shop that stops at an arbitrary
 * number of products with no way past it hides stock from the people trying to
 * buy it — and says nothing about having done so.
 *
 * A client component because it holds the pages already shown and appends to
 * them; the cards themselves are the same server-first `ProductCard` the rest of
 * the shop uses.
 *
 * `filters` is what the page was filtered by, and is passed back unchanged with
 * each cursor so page two is page two of the *same* list. The page remounts this
 * component (via `key`) when the filters change, so stale products from a
 * previous filter can never be shown under a new one.
 */
export function ProductFeed({
  initial,
  filters,
  emptyMessage,
}: {
  initial: Page;
  filters: Readonly<Record<string, string>>;
  emptyMessage: string;
}) {
  const [products, setProducts] = useState(initial.products);
  const [likes, setLikes] = useState(initial.likes);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [total, setTotal] = useState(initial.total);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /**
   * Keyboard and screen-reader users are left on the button they pressed, which
   * has just moved down the page. Putting focus on the first new card tells them
   * where the new products begin.
   */
  const listRef = useRef<HTMLDivElement>(null);
  const focusFrom = useRef<number | null>(null);
  useEffect(() => {
    if (focusFrom.current === null) return;
    const links = listRef.current?.querySelectorAll<HTMLAnchorElement>('a[href^="/products/"]');
    links?.[focusFrom.current]?.focus();
    focusFrom.current = null;
  }, [products]);

  async function showMore() {
    if (cursor === null || loading) return;
    setLoading(true);
    setFailed(null);
    try {
      const query = new URLSearchParams({ ...filters, cursor });
      const response = await fetch(`/api/v1/products?${query.toString()}`);
      const body = (await response.json()) as ApiResponse;
      if (!body.ok) {
        setFailed(body.error.message);
        return;
      }
      const page = body.data;
      focusFrom.current = products.length;
      // Deduplicated by id: a retry after a dropped connection, or a product
      // published between two pages, must not put one card on screen twice.
      setProducts((current) => {
        const seen = new Set(current.map((product) => product.id));
        return [...current, ...page.products.filter((product) => !seen.has(product.id))];
      });
      setLikes((current) => ({ ...current, ...page.likes }));
      setCursor(page.nextCursor);
      setTotal(page.total);
    } catch {
      setFailed("We could not load more products. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div ref={listRef}>
        <ProductGrid
          products={products}
          likes={new Map(Object.entries(likes))}
          emptyMessage={emptyMessage}
        />
      </div>

      {products.length > 0 ? (
        <div className="mt-8 grid justify-items-center gap-3 text-center">
          {/* Always said, so a shopper knows whether they have seen it all. */}
          <p className="text-sm text-(--pv-muted)" role="status">
            {cursor === null
              ? `Showing all ${products.length} ${products.length === 1 ? "product" : "products"}`
              : `Showing ${products.length} of ${total} products`}
          </p>

          {failed === null ? null : (
            <p className="text-sm font-semibold text-(--pv-red)" role="alert">
              {failed}
            </p>
          )}

          {cursor === null ? null : (
            <button
              type="button"
              onClick={showMore}
              disabled={loading}
              className="button-secondary button-square min-w-48"
            >
              {loading ? "Loading…" : failed === null ? "Show more" : "Try again"}
            </button>
          )}
        </div>
      ) : null}
    </>
  );
}
