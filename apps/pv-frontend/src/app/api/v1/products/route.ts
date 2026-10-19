import { productListQuerySchema } from "@pv/backend/domain/schemas";
import { listPublishedProducts, type ProductListFilters } from "@pv/backend/services/catalogue";
import { fail, ok, toApiError } from "@/server/api";
import { likeSummaryFor } from "@/server/product-likes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One page of the published catalogue.
 *
 * The shop renders its first page on the server and asks here for the rest, so a
 * shopper can reach every product without the page having to ship them all up
 * front — and so a POS sync or a mobile app gets the same listing the website
 * does, rather than a second implementation of it (AGENTS.md §3).
 *
 * `nextCursor` is opaque: hand it back unchanged as `cursor`. It is `null` on the
 * last page. `total` is every match, not the size of this page.
 *
 * Like state rides along with the products because a card is drawn with its
 * heart, and a second round trip for it would be a second chance for a mobile
 * connection to drop between a card appearing and it being usable.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = productListQuerySchema.safeParse({
    category: url.searchParams.get("category") ?? undefined,
    brand: url.searchParams.get("brand") ?? undefined,
    device: url.searchParams.get("device") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return fail("validation_failed", "Those filters are not valid.", {
      ...parsed.error.flatten().fieldErrors,
    });
  }

  const { category, brand, device, q, cursor, limit } = parsed.data;
  const filters: ProductListFilters = {
    withTotal: true,
    ...(category ? { categorySlug: category } : {}),
    ...(brand ? { brandSlug: brand } : {}),
    ...(device ? { deviceSlug: device } : {}),
    ...(q ? { search: q } : {}),
    ...(cursor ? { cursor } : {}),
    ...(limit ? { limit } : {}),
  };

  try {
    const { products, nextCursor, total } = await listPublishedProducts(filters);
    const likes = await likeSummaryFor(products);
    return ok(
      { products, nextCursor, total, likes: Object.fromEntries(likes) },
      // Per-visitor like state means a shared cache must never serve this.
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return toApiError(error);
  }
}
