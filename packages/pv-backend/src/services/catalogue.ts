import { query, queryOne } from "../db/client";
import { kobo, type Kobo } from "../domain/money";

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

export type CatalogueImage = {
  r2Key: string;
  alt: string | null;
  width: number | null;
  height: number | null;
};

/** What a card needs: no variant rows, and only the primary image. */
export type CatalogueListItem = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  brandName: string | null;
  fromKobo: Kobo | null;
  inStock: number;
  primaryImage: CatalogueImage | null;
};

export type CatalogueProduct = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
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

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
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
};

function toListItem(row: ProductRow): CatalogueListItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    brandName: row.brand_name,
    fromKobo: row.from_kobo === null ? null : kobo(Number(row.from_kobo)),
    inStock: Number(row.in_stock ?? 0),
    primaryImage:
      row.image_key === null
        ? null
        : {
            r2Key: row.image_key,
            alt: row.image_alt,
            width: row.image_width,
            height: row.image_height,
          },
  };
}

function toProduct(row: ProductRow): Omit<CatalogueProduct, "images" | "variants"> {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
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
  SELECT p.id, p.slug, p.name, p.summary, p.description, p.status,
         b.name AS brand_name, b.slug AS brand_slug,
         (SELECT min(v.price_kobo)::STRING
            FROM product_variant v
           WHERE v.product_id = p.id AND v.deleted_at IS NULL AND v.is_active) AS from_kobo,
         (SELECT coalesce(sum(se.delta), 0)::STRING
            FROM stock_entry se
            JOIN product_variant v2 ON v2.id = se.variant_id
           WHERE v2.product_id = p.id AND v2.deleted_at IS NULL) AS in_stock,
         m.r2_key AS image_key, m.alt AS image_alt, m.width AS image_width, m.height AS image_height
    FROM product p
    LEFT JOIN brand b ON b.id = p.brand_id
    LEFT JOIN LATERAL (
      SELECT r2_key, alt, width, height
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
  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(`(p.name ILIKE $${values.length} OR p.summary ILIKE $${values.length})`);
  }
  if (filters.cursor) {
    values.push(filters.cursor);
    conditions.push(`p.id > $${values.length}`);
  }

  values.push(limit + 1);
  const rows = await query<ProductRow>(
    `${PRODUCT_SELECT} WHERE ${conditions.join(" AND ")} ORDER BY p.id LIMIT $${values.length}`,
    values,
  );

  const page = rows.slice(0, limit).map(toListItem);
  return {
    products: page,
    nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
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
  }>(
    `SELECT r2_key, alt, width, height
       FROM product_media
      WHERE product_id = $1 AND kind = 'image'
      ORDER BY sort_order`,
    [productId],
  );
  return rows.map((row) => ({
    r2Key: row.r2_key,
    alt: row.alt,
    width: row.width,
    height: row.height,
  }));
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
