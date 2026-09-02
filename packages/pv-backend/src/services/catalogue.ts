import { query, queryOne } from "../db/client";
import { kobo, type Kobo } from "../domain/money";
import { isStorageConfigured } from "../storage/r2";
import { urlsForHash } from "./media-urls";

/**
 * Read paths for the storefront and the admin catalogue.
 *
 * Every list is bounded and every query joins on an indexed column. Prices come
 * back as branded kobo rather than bare numbers, so a caller cannot accidentally
 * render a variant price as naira.
 */

export type CatalogueVariant = {
  id: string;
  sku: string;
  priceKobo: Kobo;
  compareAtKobo: Kobo | null;
  inStock: number;
  axes: Record<string, string>;
};

/**
 * Resolved CDN URLs, not bucket keys — a key is not addressable, and making the
 * caller build the URL is how a storefront ends up rendering a broken image.
 * `width`/`height` are the original's intrinsic dimensions so every render can
 * reserve its box and contribute nothing to CLS.
 */
export type CatalogueImage = {
  thumbUrl: string;
  cardUrl: string;
  heroUrl: string;
  alt: string | null;
  width: number | null;
  height: number | null;
};

/** What a card needs: no variant rows, and only the primary image. */
export type CatalogueListItem = {
  id: string;
  slug: string;
  name: string;
  brandName: string | null;
  fromKobo: Kobo | null;
  inStock: number;
  primaryImage: CatalogueImage | null;
};

export type CatalogueProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brandName: string | null;
  brandSlug: string | null;
  status: string;
  fromKobo: Kobo | null;
  inStock: number;
  images: CatalogueImage[];
  variants: CatalogueVariant[];
};

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 100;

/**
 * Trigram similarity a name must reach to count as a fuzzy match.
 *
 * Stated explicitly rather than relying on the `%` operator, which reads the
 * `pg_trgm.similarity_threshold` session setting — a value that would have to be
 * set on every pooled connection and could silently differ between environments.
 *
 * 0.2 rather than the 0.3 default because similarity is measured against the
 * whole product name: "otterbocks" against "OtterBox Defender Case" scores 0.26,
 * since the trailing words dilute it. Postgres solves that with
 * `word_similarity()`, which CockroachDB has not implemented.
 */
const FUZZY_THRESHOLD = 0.2;

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand_name: string | null;
  brand_slug: string | null;
  status: string;
  from_kobo: string | null;
  in_stock: string | null;
  image_key: string | null;
  image_alt: string | null;
  image_width: number | null;
  image_height: number | null;
  image_hash: string | null;
};

/**
 * Resolves a media row to CDN URLs. Returns null rather than throwing when
 * storage is unconfigured, so a misconfigured environment renders a storefront
 * without pictures instead of a 500 on every page.
 */
function toImage(
  productId: string,
  key: string | null,
  contentHash: string | null,
  alt: string | null,
  width: number | null,
  height: number | null,
): CatalogueImage | null {
  if (key === null || !isStorageConfigured()) return null;
  const urls = urlsForHash(productId, contentHash, key);
  return { thumbUrl: urls.thumb, cardUrl: urls.card, heroUrl: urls.hero, alt, width, height };
}

function toListItem(row: ProductRow): CatalogueListItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brandName: row.brand_name,
    fromKobo: row.from_kobo === null ? null : kobo(Number(row.from_kobo)),
    inStock: Number(row.in_stock ?? 0),
    primaryImage: toImage(
      row.id,
      row.image_key,
      row.image_hash,
      row.image_alt,
      row.image_width,
      row.image_height,
    ),
  };
}

function toProduct(row: ProductRow): Omit<CatalogueProduct, "images" | "variants"> {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    brandName: row.brand_name,
    brandSlug: row.brand_slug,
    status: row.status,
    fromKobo: row.from_kobo === null ? null : kobo(Number(row.from_kobo)),
    inStock: Number(row.in_stock ?? 0),
  };
}

/**
 * Stock is summed from the ledger rather than read from a counter, so the number
 * is always derivable from history and never drifts.
 */
const PRODUCT_SELECT = `
  SELECT p.id, p.slug, p.name, p.description, p.status,
         b.name AS brand_name, b.slug AS brand_slug,
         (SELECT min(v.price_kobo)::STRING
            FROM product_variant v
           WHERE v.product_id = p.id AND v.deleted_at IS NULL AND v.is_active) AS from_kobo,
         (SELECT coalesce(sum(se.delta), 0)::STRING
            FROM stock_entry se
            JOIN product_variant v2 ON v2.id = se.variant_id
           WHERE v2.product_id = p.id AND v2.deleted_at IS NULL) AS in_stock,
         m.r2_key AS image_key, m.alt AS image_alt, m.width AS image_width,
         m.height AS image_height, m.content_hash AS image_hash
    FROM product p
    LEFT JOIN brand b ON b.id = p.brand_id
    LEFT JOIN LATERAL (
      SELECT r2_key, alt, width, height, content_hash
        FROM product_media
       WHERE product_id = p.id AND kind = 'image'
       ORDER BY sort_order
       LIMIT 1
    ) m ON true
`;

export type ProductListFilters = {
  categorySlug?: string;
  brandSlug?: string;
  deviceSlug?: string;
  search?: string;
  limit?: number;
  cursor?: string;
};

/**
 * Cursor pagination on `(published_at, id)`. Offset pagination shifts under a
 * concurrent insert and re-shows or skips a row; a cursor cannot.
 */
export async function listPublishedProducts(filters: ProductListFilters = {}) {
  const limit = Math.min(filters.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const conditions = ["p.deleted_at IS NULL", "p.status = 'published'"];
  const values: unknown[] = [];

  if (filters.categorySlug) {
    values.push(filters.categorySlug);
    conditions.push(`EXISTS (
      SELECT 1 FROM product_category pc
        JOIN category c ON c.id = pc.category_id
       WHERE pc.product_id = p.id AND c.slug = $${values.length} AND c.deleted_at IS NULL
    )`);
  }
  if (filters.brandSlug) {
    values.push(filters.brandSlug);
    conditions.push(`b.slug = $${values.length}`);
  }
  if (filters.deviceSlug) {
    values.push(filters.deviceSlug);
    conditions.push(`EXISTS (
      SELECT 1 FROM product_compatibility pcm
        JOIN device d ON d.id = pcm.device_id
       WHERE pcm.product_id = p.id AND d.slug = $${values.length}
    )`);
  }
  /**
   * Full text first, trigram second. The `@@` arm answers "these words appear",
   * the `%` arm catches a misspelling the tokeniser would never match, and the
   * ranking below orders by both together. Results are ordered by relevance, so
   * cursor pagination does not apply to a search.
   */
  const search = filters.search?.trim();
  let term = "";
  if (search) {
    values.push(search);
    term = `$${values.length}`;
    conditions.push(
      `(p.search_vector @@ plainto_tsquery('english', ${term})
        OR similarity(p.name, ${term}) >= ${FUZZY_THRESHOLD})`,
    );
  }

  // A search is ordered by relevance, so an id cursor would be meaningless.
  if (filters.cursor && !search) {
    values.push(filters.cursor);
    conditions.push(`p.id > $${values.length}`);
  }

  const order = search
    ? `ORDER BY (ts_rank(p.search_vector, plainto_tsquery('english', ${term}))
                 + similarity(p.name, ${term})) DESC, p.id`
    : "ORDER BY p.id";

  values.push(limit + 1);
  const rows = await query<ProductRow>(
    `${PRODUCT_SELECT} WHERE ${conditions.join(" AND ")} ${order} LIMIT $${values.length}`,
    values,
  );

  const page = rows.slice(0, limit).map(toListItem);
  return {
    products: page,
    // Relevance order is not a stable cursor key, so a search returns one page.
    nextCursor: search || rows.length <= limit ? null : (page[page.length - 1]?.id ?? null),
  };
}

export async function getPublishedProductBySlug(slug: string): Promise<CatalogueProduct | null> {
  const row = await queryOne<ProductRow>(
    `${PRODUCT_SELECT} WHERE p.deleted_at IS NULL AND p.status = 'published' AND p.slug = $1`,
    [slug],
  );
  if (row === null) return null;

  const [variants, images] = await Promise.all([listVariants(row.id), listImages(row.id)]);
  return { ...toProduct(row), variants, images };
}

export async function listVariants(productId: string): Promise<CatalogueVariant[]> {
  const rows = await query<{
    id: string;
    sku: string;
    price_kobo: string;
    compare_at_kobo: string | null;
    in_stock: string | null;
    axes: Record<string, string> | null;
  }>(
    `SELECT v.id, v.sku, v.price_kobo::STRING AS price_kobo,
            v.compare_at_kobo::STRING AS compare_at_kobo,
            (SELECT coalesce(sum(se.delta), 0)::STRING
               FROM stock_entry se WHERE se.variant_id = v.id) AS in_stock,
            (SELECT jsonb_object_agg(vv.axis_code, vv.value)
               FROM variant_value vv WHERE vv.variant_id = v.id) AS axes
       FROM product_variant v
      WHERE v.product_id = $1 AND v.deleted_at IS NULL AND v.is_active
      ORDER BY v.sort_order, v.sku`,
    [productId],
  );
  return rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    priceKobo: kobo(Number(row.price_kobo)),
    compareAtKobo: row.compare_at_kobo === null ? null : kobo(Number(row.compare_at_kobo)),
    inStock: Number(row.in_stock ?? 0),
    axes: row.axes ?? {},
  }));
}

export async function listImages(productId: string): Promise<CatalogueImage[]> {
  const rows = await query<{
    r2_key: string;
    alt: string | null;
    width: number | null;
    height: number | null;
    content_hash: string | null;
  }>(
    `SELECT r2_key, alt, width, height, content_hash
       FROM product_media
      WHERE product_id = $1 AND kind = 'image'
      ORDER BY sort_order`,
    [productId],
  );
  return rows
    .map((row) => toImage(productId, row.r2_key, row.content_hash, row.alt, row.width, row.height))
    .filter((image): image is CatalogueImage => image !== null);
}

/**
 * The same cards, for an explicit list of products in an order chosen elsewhere.
 *
 * A hand-picked home section knows *which* products it shows and in what order,
 * but nothing about how a card is built. Rather than let it assemble its own
 * rows — which is how a curated grid ends up rendering a different price or a
 * different image from the rest of the shop — it passes ids here and gets the
 * catalogue's own card back.
 *
 * Unpublished and deleted ids are dropped rather than rejected: a section that
 * outlives one of its products should quietly show the rest, not 500.
 */
export async function listPublishedProductsByIds(ids: string[]): Promise<CatalogueListItem[]> {
  if (ids.length === 0) return [];
  const capped = ids.slice(0, MAX_PAGE_SIZE);

  const rows = await query<ProductRow>(
    `${PRODUCT_SELECT}
      WHERE p.deleted_at IS NULL AND p.status = 'published' AND p.id = ANY($1::UUID[])`,
    [capped],
  );

  // Restore the caller's order. The database returns whatever the scan gives,
  // and for a curated section the order *is* the editorial decision.
  const byId = new Map(rows.map((row) => [row.id, toListItem(row)]));
  return capped
    .map((id) => byId.get(id))
    .filter((product): product is CatalogueListItem => product !== undefined);
}

export type CategoryNode = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  children: CategoryNode[];
};

/** Two tiers, assembled in one round trip rather than a query per parent. */
export async function listCategoryTree(): Promise<CategoryNode[]> {
  const rows = await query<{
    id: string;
    parent_id: string | null;
    slug: string;
    name: string;
    description: string | null;
  }>(
    `SELECT id, parent_id, slug, name, description
       FROM category
      WHERE deleted_at IS NULL AND is_active
      ORDER BY sort_order, name`,
  );

  const nodes = new Map<string, CategoryNode>(
    rows.map((row) => [
      row.id,
      { id: row.id, slug: row.slug, name: row.name, description: row.description, children: [] },
    ]),
  );
  const roots: CategoryNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id);
    if (node === undefined) continue;
    const parent = row.parent_id === null ? undefined : nodes.get(row.parent_id);
    if (parent === undefined) roots.push(node);
    else parent.children.push(node);
  }
  return roots;
}

export async function listBrands() {
  return query<{ id: string; slug: string; name: string }>(
    `SELECT id, slug, name FROM brand
      WHERE deleted_at IS NULL AND is_active
      ORDER BY sort_order, name`,
  );
}

export async function listDevices() {
  return query<{ id: string; slug: string; name: string; brand_name: string }>(
    `SELECT d.id, d.slug, d.name, b.name AS brand_name
       FROM device d JOIN brand b ON b.id = d.brand_id
      ORDER BY b.sort_order, d.sort_order, d.name`,
  );
}

/** Whether the catalogue has anything published, so the UI can say so honestly. */
export async function catalogueIsEmpty(): Promise<boolean> {
  const row = await queryOne<{ total: string }>(
    "SELECT count(*)::STRING AS total FROM product WHERE deleted_at IS NULL AND status = 'published'",
  );
  return Number(row?.total ?? 0) === 0;
}

export async function countAllProducts(): Promise<{ total: number; published: number }> {
  const row = await queryOne<{ total: string; published: string }>(
    `SELECT count(*)::STRING AS total,
            count(*) FILTER (WHERE status = 'published')::STRING AS published
       FROM product WHERE deleted_at IS NULL`,
  );
  return { total: Number(row?.total ?? 0), published: Number(row?.published ?? 0) };
}
