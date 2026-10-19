import { query, queryOne } from "../db/client";
import { axesFromPairs, VARIANT_AXES_SELECT, type VariantAxisPairs } from "../db/variant-axes";
import { kobo, type Kobo } from "../domain/money";
import type { CategoriesByDevice } from "../domain/device-categories";
import { decodeProductCursor, encodeProductCursor } from "../domain/product-cursor";
import { isStorageConfigured } from "../storage/r2";
import { urlsForHash } from "./media-urls";
import {
  catalogueImageFrom,
  catalogueImageUrl,
  type CatalogueImageRef,
} from "./catalogue-media-urls";

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
 *
 * There is no `alt`. Staff were asked to write one per image and the admin no
 * longer collects it: what got written was rarely better than the product's own
 * name, and what got left blank was worse. Every caller names the picture after
 * the product it belongs to, which is always true and always present.
 */
export type CatalogueImage = {
  thumbUrl: string;
  cardUrl: string;
  heroUrl: string;
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
  image_width: string | null;
  image_height: string | null;
  image_hash: string | null;
  /** The timestamp the list is ordered by, as text so no precision is lost to a JS Date. */
  sort_at: string;
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
  /** `INT` columns, so strings off the wire. See the coercion below. */
  width: string | null,
  height: string | null,
): CatalogueImage | null {
  if (key === null || !isStorageConfigured()) return null;
  const urls = urlsForHash(productId, contentHash, key);
  return {
    thumbUrl: urls.thumb,
    cardUrl: urls.card,
    heroUrl: urls.hero,
    // `width` and `height` are INT columns, which this driver hands back as
    // strings. Left alone the declared `number` is a lie the compiler cannot
    // see, and the first caller to do arithmetic on it gets "447447".
    width: width === null ? null : Number(width),
    height: height === null ? null : Number(height),
  };
}

function toListItem(row: ProductRow): CatalogueListItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brandName: row.brand_name,
    fromKobo: row.from_kobo === null ? null : kobo(Number(row.from_kobo)),
    inStock: Number(row.in_stock ?? 0),
    primaryImage: toImage(row.id, row.image_key, row.image_hash, row.image_width, row.image_height),
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
 * When a product joined the shop. `published_at` is null on a product that was
 * published before that column was filled in, so those fall back to creation
 * rather than sorting to an end of the list nobody scrolls to.
 */
const NEWEST_FIRST = "coalesce(p.published_at, p.created_at)";

/**
 * Stock is summed from the ledger rather than read from a counter, so the number
 * is always derivable from history and never drifts.
 */
const PRODUCT_SELECT = `
  SELECT p.id, p.slug, p.name, p.description, p.status,
         b.name AS brand_name, b.slug AS brand_slug,
         ${NEWEST_FIRST}::STRING AS sort_at,
         (SELECT min(v.price_kobo)::STRING
            FROM product_variant v
           WHERE v.product_id = p.id AND v.deleted_at IS NULL AND v.is_active) AS from_kobo,
         (SELECT coalesce(sum(se.delta), 0)::STRING
            FROM stock_entry se
            JOIN product_variant v2 ON v2.id = se.variant_id
           WHERE v2.product_id = p.id AND v2.deleted_at IS NULL) AS in_stock,
         m.r2_key AS image_key, m.width AS image_width,
         m.height AS image_height, m.content_hash AS image_hash
    FROM product p
    LEFT JOIN brand b ON b.id = p.brand_id
    LEFT JOIN LATERAL (
      SELECT r2_key, width, height, content_hash
        FROM product_media
       WHERE product_id = p.id AND kind = 'image'
       ORDER BY sort_order
       LIMIT 1
    ) m ON true
`;

/**
 * The ids of a category and everything filed beneath it, as a subquery.
 *
 * Categories are two tiers — "Pouch" holds "Luxury" and "Protective" — and a
 * shopper asking for the parent means the whole branch. Written as a recursive
 * CTE inside the subquery rather than a fixed two-level join so a third tier,
 * if the shop ever grows one, needs no change here.
 *
 * `placeholder` is a `$n` produced by the caller's own parameter list — never a
 * value. §5 forbids interpolating anything else into SQL, and this function
 * takes no other argument for exactly that reason.
 */
function categorySubtreeIds(placeholder: string): string {
  return `WITH RECURSIVE subtree AS (
            SELECT id FROM category WHERE slug = ${placeholder} AND deleted_at IS NULL
            UNION ALL
            SELECT child.id FROM category child
              JOIN subtree ON child.parent_id = subtree.id
             WHERE child.deleted_at IS NULL
          )
          SELECT id FROM subtree`;
}

export type ProductListFilters = {
  categorySlug?: string;
  brandSlug?: string;
  deviceSlug?: string;
  search?: string;
  limit?: number;
  cursor?: string;
  /**
   * Also count every match. Off by default: the home page and the curated
   * sections never show a total, and a count is a second query on the
   * busiest page in the shop.
   */
  withTotal?: boolean;
};

export class InvalidProductCursorError extends Error {
  constructor() {
    super("That page of results is no longer valid. Reload the list and try again.");
    this.name = "InvalidProductCursorError";
  }
}

/**
 * The WHERE clause shared by the list and its count, so the "of 137" a shopper is
 * told can never disagree with the products they can page through.
 *
 * Only values go in `values`; nothing a caller supplies is ever interpolated into
 * the SQL text (AGENTS.md §5).
 */
function productFilter(filters: ProductListFilters, search: string) {
  const conditions = ["p.deleted_at IS NULL", "p.status = 'published'"];
  const values: unknown[] = [];

  if (filters.categorySlug) {
    values.push(filters.categorySlug);
    // The whole subtree, not the one row. Asking for "pouches" must return the
    // luxury and protective cases filed under it, or a parent category is a
    // heading that leads to an empty shop.
    conditions.push(`EXISTS (
      SELECT 1 FROM product_category pc
       WHERE pc.product_id = p.id
         AND pc.category_id IN (${categorySubtreeIds(`$${values.length}`)})
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
   * ranking orders by both together.
   */
  let term = "";
  if (search) {
    values.push(search);
    term = `$${values.length}`;
    conditions.push(
      `(p.search_vector @@ plainto_tsquery('english', ${term})
        OR similarity(p.name, ${term}) >= ${FUZZY_THRESHOLD})`,
    );
  }
  return { conditions, values, term };
}

/**
 * One page of the published catalogue, and — on request — how many products match
 * in all.
 *
 * Browse is newest first, paged by keyset on `(published_at, id)`: offset paging
 * shifts under a concurrent publish and re-shows or skips a row; a keyset
 * cannot. Search is ordered by relevance and pages by offset — see
 * `domain/product-cursor`. A cursor from the other kind of list is refused rather
 * than guessed at.
 */
export async function listPublishedProducts(filters: ProductListFilters = {}) {
  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const search = filters.search?.trim() ?? "";
  const { conditions, values, term } = productFilter(filters, search);
  const where = conditions.join(" AND ");

  const cursor = filters.cursor ? decodeProductCursor(filters.cursor) : null;
  if (filters.cursor && (cursor === null || (cursor.kind === "search") !== Boolean(search))) {
    throw new InvalidProductCursorError();
  }

  // The count must not see the cursor: it answers "how many in all", not "how
  // many remain". It takes the parameters as they are before the page adds its own.
  const countValues = [...values];
  const pageConditions = [...conditions];
  let offset = 0;

  if (cursor?.kind === "browse") {
    values.push(cursor.sortedAt, cursor.id);
    const at = `$${values.length - 1}::TIMESTAMPTZ`;
    pageConditions.push(
      `(${NEWEST_FIRST} < ${at} OR (${NEWEST_FIRST} = ${at} AND p.id > $${values.length}::UUID))`,
    );
  } else if (cursor?.kind === "search") {
    offset = cursor.offset;
  }

  const order = search
    ? `ORDER BY (ts_rank(p.search_vector, plainto_tsquery('english', ${term}))
                 + similarity(p.name, ${term})) DESC, p.id`
    : `ORDER BY ${NEWEST_FIRST} DESC, p.id`;

  values.push(limit + 1);
  const limitParam = `$${values.length}`;
  let offsetClause = "";
  if (offset > 0) {
    values.push(offset);
    offsetClause = `OFFSET $${values.length}`;
  }

  const [rows, counted] = await Promise.all([
    query<ProductRow>(
      `${PRODUCT_SELECT} WHERE ${pageConditions.join(" AND ")} ${order}
        LIMIT ${limitParam} ${offsetClause}`,
      values,
    ),
    filters.withTotal
      ? queryOne<{ total: string }>(
          `SELECT count(*)::STRING AS total
             FROM product p LEFT JOIN brand b ON b.id = p.brand_id
            WHERE ${where}`,
          countValues,
        )
      : Promise.resolve(null),
  ]);

  const pageRows = rows.slice(0, limit);
  const last = pageRows[pageRows.length - 1];
  const hasMore = rows.length > limit && last !== undefined;

  let nextCursor: string | null = null;
  if (hasMore) {
    nextCursor = encodeProductCursor(
      search
        ? { kind: "search", offset: offset + limit }
        : { kind: "browse", sortedAt: last.sort_at, id: last.id },
    );
  }

  return {
    products: pageRows.map(toListItem),
    nextCursor,
    /** Every match across all pages, or `null` where `withTotal` was not asked for. */
    total: counted === null ? null : Number(counted?.total ?? 0),
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
    axes: VariantAxisPairs;
  }>(
    `SELECT v.id, v.sku, v.price_kobo::STRING AS price_kobo,
            v.compare_at_kobo::STRING AS compare_at_kobo,
            (SELECT coalesce(sum(se.delta), 0)::STRING
               FROM stock_entry se WHERE se.variant_id = v.id) AS in_stock,
            ${VARIANT_AXES_SELECT} AS axes
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
    axes: axesFromPairs(row.axes),
  }));
}

export async function listImages(productId: string): Promise<CatalogueImage[]> {
  const rows = await query<{
    r2_key: string;
    width: string | null;
    height: string | null;
    content_hash: string | null;
  }>(
    `SELECT r2_key, width, height, content_hash
       FROM product_media
      WHERE product_id = $1 AND kind = 'image'
      ORDER BY sort_order`,
    [productId],
  );
  return rows
    .map((row) => toImage(productId, row.r2_key, row.content_hash, row.width, row.height))
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

/**
 * A category as a card: its name, and a photograph of something actually in it.
 *
 * The picture is the primary image of the most recently published product in the
 * category, rather than an image uploaded against the category itself. That is a
 * deliberate choice and not only the cheaper one:
 *
 *   - There is nothing to invent and nothing to go stale. §0 rule 2 rules out a
 *     stock photograph standing in for a category the shop has not stocked yet;
 *     a category with no products returns no image and the card says so.
 *   - It stays true on its own. Staff never have to remember to change a
 *     category picture after the range behind it changes.
 *
 * That was written when a category had nowhere to store a picture of its own.
 * It now does — `catalogue_media`, set on the Brands & Categories admin page —
 * and the CEO's own photograph wins where there is one. The borrowed product
 * image stays as the fallback rather than being deleted, because it is still the
 * right answer for a category nobody has photographed yet: a real picture of
 * real stock, and never an invented one.
 */
/**
 * The top of the catalogue: root categories only, each with everything filed
 * beneath it counted and a photograph taken from anything inside the branch.
 *
 * This is what the home page shows. `listCategoryCards` below still lists every
 * category flat for the browse-all page; this one answers the different question
 * "what are the two or three ways into this shop", and a sub-category appearing
 * beside its own parent would make that question unanswerable.
 *
 * The count and the image both walk the subtree, so a parent that holds no
 * products directly — which is the normal case once kinds are filed under it —
 * still shows a real number and a real picture rather than an empty card.
 */
export async function listTopCategoryCards(): Promise<CategoryCard[]> {
  const rows = await query<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    product_count: string;
    image_product_id: string | null;
    image_key: string | null;
    image_width: string | null;
    image_height: string | null;
    image_hash: string | null;
    own_hash: string | null;
    own_width: string | null;
    own_height: string | null;
  }>(
    `SELECT c.id, c.slug, c.name, c.description,
            (SELECT count(DISTINCT p.id)::STRING
               FROM product_category pc
               JOIN product p ON p.id = pc.product_id
              WHERE p.deleted_at IS NULL AND p.status = 'published'
                AND pc.category_id IN (
                  WITH RECURSIVE branch AS (
                    SELECT c.id AS id
                    UNION ALL
                    SELECT child.id FROM category child
                      JOIN branch ON child.parent_id = branch.id
                     WHERE child.deleted_at IS NULL
                  )
                  SELECT id FROM branch
                )) AS product_count,
            m.product_id AS image_product_id,
            m.r2_key AS image_key, m.width AS image_width,
            m.height AS image_height, m.content_hash AS image_hash,
            own.content_hash AS own_hash, own.width AS own_width, own.height AS own_height
       FROM category c
       LEFT JOIN catalogue_media own ON own.category_id = c.id
       LEFT JOIN LATERAL (
         SELECT pm.product_id, pm.r2_key, pm.width, pm.height, pm.content_hash
           FROM product_category pc
           JOIN product p ON p.id = pc.product_id
           JOIN product_media pm ON pm.product_id = p.id AND pm.kind = 'image'
          WHERE p.deleted_at IS NULL AND p.status = 'published'
            AND pc.category_id IN (
              WITH RECURSIVE branch AS (
                SELECT c.id AS id
                UNION ALL
                SELECT child.id FROM category child
                  JOIN branch ON child.parent_id = branch.id
                 WHERE child.deleted_at IS NULL
              )
              SELECT id FROM branch
            )
          ORDER BY p.published_at DESC, pm.sort_order
          LIMIT 1
       ) m ON true
      WHERE c.deleted_at IS NULL AND c.is_active AND c.parent_id IS NULL
      ORDER BY c.sort_order, c.name`,
  );

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    parentName: null,
    productCount: Number(row.product_count),
    // The CEO's own photograph first, the borrowed product image second, and a
    // typed absence third — the card draws its own lettered panel for that case.
    image:
      ownCategoryImage(row.id, row.own_hash, row.own_width, row.own_height) ??
      (row.image_product_id === null
        ? null
        : toImage(
            row.image_product_id,
            row.image_key,
            row.image_hash,
            row.image_width,
            row.image_height,
          )),
  }));
}

/**
 * The category's own photograph, shaped like a product image so the card does
 * not have to know which of the two it received.
 *
 * One rendition serves all three slots. A category tile renders at card size on
 * every surface that uses it, so generating and storing a hero and a thumb of a
 * picture nothing displays at those sizes would be storage spent on nothing.
 */
function ownCategoryImage(
  categoryId: string,
  contentHash: string | null | undefined,
  width: string | null | undefined,
  height: string | null | undefined,
): CatalogueImage | null {
  // `== null` catches `undefined` too. Rows reach here through a cast rather
  // than a parse, so a query that forgets the join columns would otherwise build
  // a URL containing the word "undefined" and put a broken image on the page.
  if (contentHash == null || !isStorageConfigured()) return null;
  const url = catalogueImageUrl("category", categoryId, contentHash);
  return {
    thumbUrl: url,
    cardUrl: url,
    heroUrl: url,
    width: width == null ? null : Number(width),
    height: height == null ? null : Number(height),
  };
}

export type CategoryCard = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** The parent's name where this is a sub-category, so a flat grid keeps the tier. */
  parentName: string | null;
  productCount: number;
  image: CatalogueImage | null;
};

/**
 * Category tiles, optionally narrowed to one section's children.
 *
 * One query with a conditional filter rather than a second near-identical one:
 * the tile's image fallback and product count are eight lines of SQL each, and
 * two copies of that is two places for the storefront's own artwork rules to
 * drift apart.
 */
export async function listCategoryCards(
  options: { parentSlug?: string } = {},
): Promise<CategoryCard[]> {
  const rows = await query<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    parent_name: string | null;
    product_count: string;
    image_product_id: string | null;
    image_key: string | null;
    image_width: string | null;
    image_height: string | null;
    image_hash: string | null;
    own_hash: string | null;
    own_width: string | null;
    own_height: string | null;
  }>(
    `SELECT c.id, c.slug, c.name, c.description, parent.name AS parent_name,
            (SELECT count(*)::STRING
               FROM product_category pc
               JOIN product p ON p.id = pc.product_id
              WHERE pc.category_id = c.id
                AND p.deleted_at IS NULL AND p.status = 'published') AS product_count,
            m.product_id AS image_product_id,
            m.r2_key AS image_key, m.width AS image_width,
            m.height AS image_height, m.content_hash AS image_hash,
            own.content_hash AS own_hash, own.width AS own_width, own.height AS own_height
       FROM category c
       LEFT JOIN category parent ON parent.id = c.parent_id AND parent.deleted_at IS NULL
       LEFT JOIN catalogue_media own ON own.category_id = c.id
       LEFT JOIN LATERAL (
         SELECT pm.product_id, pm.r2_key, pm.width, pm.height, pm.content_hash
           FROM product_category pc
           JOIN product p ON p.id = pc.product_id
           JOIN product_media pm ON pm.product_id = p.id AND pm.kind = 'image'
          WHERE pc.category_id = c.id
            AND p.deleted_at IS NULL AND p.status = 'published'
          ORDER BY p.published_at DESC, pm.sort_order
          LIMIT 1
       ) m ON true
      WHERE c.deleted_at IS NULL AND c.is_active
        ${options.parentSlug === undefined ? "" : "AND parent.slug = $1"}
      ORDER BY c.sort_order, c.name`,
    options.parentSlug === undefined ? [] : [options.parentSlug],
  );

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    parentName: row.parent_name,
    productCount: Number(row.product_count),
    // The CEO's own photograph first, the borrowed product image second, and a
    // typed absence third — the card draws its own lettered panel for that case.
    image:
      ownCategoryImage(row.id, row.own_hash, row.own_width, row.own_height) ??
      (row.image_product_id === null
        ? null
        : toImage(
            row.image_product_id,
            row.image_key,
            row.image_hash,
            row.image_width,
            row.image_height,
          )),
  }));
}

/** Just enough to draw a navigation entry: no counts, no logo, no join. */
export type BrandLink = { id: string; slug: string; name: string };

/**
 * Every make the shop actually has something published for.
 *
 * For the sidebar's brand menu. Deliberately the narrowest query in this file —
 * three columns, one index, no aggregate — because it runs on **every**
 * storefront page as part of the layout, and the brand strip that used to live
 * in the header was removed partly for costing exactly that.
 *
 * `EXISTS` rather than a join with `GROUP BY`: the menu shows names, not counts,
 * and `EXISTS` stops at the first published product per brand instead of
 * counting all of them.
 */
export async function listBrandLinks(): Promise<BrandLink[]> {
  const rows = await query<{ id: string; slug: string; name: string }>(
    `SELECT b.id, b.slug, b.name
       FROM brand b
      WHERE b.deleted_at IS NULL AND b.is_active
        AND EXISTS (
          SELECT 1 FROM product p
           WHERE p.brand_id = b.id AND p.deleted_at IS NULL AND p.status = 'published'
        )
      ORDER BY b.sort_order, b.name`,
  );
  return rows;
}

export type StorefrontBrand = {
  id: string;
  slug: string;
  name: string;
  productCount: number;
  /**
   * The logo the CEO set on the Brands & Categories page, or a typed absence.
   *
   * The brand step is meant to be carried by these — the client asked for cards
   * that hold the logo prominently with the name on one line beneath. Absent,
   * the card draws the brand's initial rather than an empty box, so a shop
   * halfway through uploading logos still looks deliberate.
   */
  logo: CatalogueImageRef | null;
};

/**
 * Every make the shop stocks, with how much of it is in this category — step two
 * of the browse path: a category, then a brand, then the model, then the product.
 *
 * **The category no longer decides which brands exist, only their counts.** It
 * used to: a brand appeared here only if it had a published product filed under
 * this category. That read as a bug to the client, and fairly — they had set up
 * and photographed a dozen makes and the Pouches step offered three, with no
 * indication the others were even known about. Filing is also the easiest thing
 * to get wrong in the admin, so the strict version punished a mis-tagged product
 * by hiding a whole brand.
 *
 * Nothing here strands a shopper. A make with nothing in this category still
 * leads somewhere honest: `/browse/[category]/[brand]` redirects to the filtered
 * shop when it has no models to offer, and that page says which filter emptied
 * it and offers a way back out.
 *
 * A brand with no published products *anywhere* is still excluded. That is not
 * the client's complaint and a card for it could only ever lead to an empty
 * page — there is no filing mistake to forgive, because there is nothing filed.
 *
 * Written as a scalar subquery rather than a `count(...) FILTER (WHERE EXISTS …)`
 * over a join: this cluster decorrelates correlated subqueries inside aggregates
 * and that is exactly the shape that broke the product page (decisions/0013).
 * The pattern here is the one `listTopCategoryCards` already proves works.
 */
export async function listBrandsInCategory(categorySlug: string): Promise<StorefrontBrand[]> {
  const rows = await query<{
    id: string;
    slug: string;
    name: string;
    product_count: string;
    logo_hash: string | null;
    logo_width: string | null;
    logo_height: string | null;
  }>(
    `SELECT b.id, b.slug, b.name,
            (SELECT count(DISTINCT p.id)::STRING
               FROM product p
               JOIN product_category pc ON pc.product_id = p.id
              WHERE p.brand_id = b.id AND p.deleted_at IS NULL AND p.status = 'published'
                AND pc.category_id IN (${categorySubtreeIds("$1")})) AS product_count,
            m.content_hash AS logo_hash, m.width AS logo_width, m.height AS logo_height
       FROM brand b
       LEFT JOIN catalogue_media m ON m.brand_id = b.id
      WHERE b.deleted_at IS NULL AND b.is_active
        AND EXISTS (
          SELECT 1 FROM product p2
           WHERE p2.brand_id = b.id AND p2.deleted_at IS NULL AND p2.status = 'published'
        )
      ORDER BY b.sort_order, b.name`,
    [categorySlug],
  );

  const brands = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    productCount: Number(row.product_count),
    logo: isStorageConfigured()
      ? catalogueImageFrom("brand", row.id, row.logo_hash, row.logo_width, row.logo_height)
      : null,
  }));

  /**
   * Makes with stock in this category first, each group still in the order the
   * CEO set in the admin.
   *
   * Sorted here rather than in SQL because ordering on a computed column means
   * either repeating the whole subquery in the `ORDER BY` or ordering on a
   * `::STRING` alias, which sorts "10" before "2". The list is one row per
   * brand, so this costs nothing worth moving into the query.
   */
  return brands.sort((a, b) => Number(b.productCount > 0) - Number(a.productCount > 0));
}

/**
 * The sub-categories under a parent that hold something from a given brand —
 * step three: having chosen Pouch and then a brand, what kinds are there.
 *
 * Both filters apply at once, so a kind with nothing from this brand behind it
 * never appears. A shopper should not be able to reach an empty result by
 * following the path the shop laid out for them.
 *
 * The parent itself is excluded. It is where they came from, and offering it
 * again as a choice inside itself reads as a loop.
 */
export type CategoryChoice = { id: string; slug: string; name: string; productCount: number };

export async function listChildCategoriesForBrand(
  parentSlug: string,
  brandSlug: string,
): Promise<CategoryChoice[]> {
  const rows = await query<{ id: string; slug: string; name: string; product_count: string }>(
    `SELECT c.id, c.slug, c.name, count(DISTINCT p.id)::STRING AS product_count
       FROM category c
       JOIN category parent ON parent.id = c.parent_id
       JOIN product_category pc ON pc.category_id = c.id
       JOIN product p ON p.id = pc.product_id
        AND p.deleted_at IS NULL AND p.status = 'published'
       JOIN brand b ON b.id = p.brand_id AND b.slug = $2
      WHERE c.deleted_at IS NULL AND c.is_active
        AND parent.slug = $1 AND parent.deleted_at IS NULL
      GROUP BY c.id, c.slug, c.name, c.sort_order
      ORDER BY c.sort_order, c.name`,
    [parentSlug, brandSlug],
  );
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    productCount: Number(row.product_count),
  }));
}

export type DeviceChoice = {
  id: string;
  slug: string;
  name: string;
  productCount: number;
  /** The class it sits in, so the step can group rather than list thirty tiles. */
  lineName: string | null;
};

/**
 * The models of one make that this category actually stocks something for —
 * step three of the CEO's path: Pouches, then Apple, then which iPhone.
 *
 * Three filters at once, and all three matter. The device must belong to the
 * chosen brand; the product must be compatible with that device; and the product
 * must be filed somewhere in the chosen category's branch. Drop any one of them
 * and the screen starts offering models with nothing behind them, which is the
 * one thing a guided path must never do — a shopper who follows every step the
 * shop laid out and lands on an empty shelf blames the shop, correctly.
 *
 * Note the category is matched against the product, not against the device: a
 * device has no category, and "iPhone 15" is a fact about a phone rather than
 * about anything Pouch Villa sells.
 */
export async function listDevicesInCategoryForBrand(
  categorySlug: string,
  brandSlug: string,
): Promise<DeviceChoice[]> {
  const rows = await query<{
    id: string;
    slug: string;
    name: string;
    line_name: string | null;
    product_count: string;
  }>(
    // Ordered by the class order the CEO set, then the model's own, so the
    // grouping downstream renders in the arrangement chosen in the admin.
    `SELECT d.id, d.slug, d.name, l.name AS line_name,
            count(DISTINCT p.id)::STRING AS product_count
       FROM device d
       JOIN brand b ON b.id = d.brand_id AND b.slug = $2 AND b.deleted_at IS NULL
       LEFT JOIN device_line l ON l.id = d.line_id AND l.deleted_at IS NULL
       JOIN product_compatibility pcp ON pcp.device_id = d.id
       JOIN product p ON p.id = pcp.product_id
        AND p.deleted_at IS NULL AND p.status = 'published'
      WHERE EXISTS (
              SELECT 1 FROM product_category pc
               WHERE pc.product_id = p.id
                 AND pc.category_id IN (${categorySubtreeIds("$1")})
            )
      GROUP BY d.id, d.slug, d.name, d.sort_order, l.name, l.sort_order
      ORDER BY l.sort_order NULLS FIRST, l.name, d.sort_order, d.name`,
    [categorySlug, brandSlug],
  );
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    productCount: Number(row.product_count),
    lineName: row.line_name,
  }));
}

/** One category by slug, for naming a page after the thing it is showing. */
export async function getCategoryBySlug(slug: string): Promise<{
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /**
   * Whether this section's products are chosen by the device they fit.
   *
   * Read from the row itself rather than resolved up the tree: the browse page
   * that asks is always looking at a top-level section, and a child page has its
   * own route. `rootFitsDevices` in the category service is the resolver for
   * anywhere that genuinely holds a child.
   */
  fitsDevices: boolean;
} | null> {
  const row = await queryOne<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    fits_devices: boolean;
  }>(
    `SELECT id, slug, name, description, fits_devices
       FROM category WHERE slug = $1 AND deleted_at IS NULL AND is_active`,
    [slug],
  );
  return row === null
    ? null
    : {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        fitsDevices: row.fits_devices,
      };
}

/** One brand by slug, for the same reason. */
export async function getBrandBySlug(
  slug: string,
): Promise<{ id: string; slug: string; name: string } | null> {
  return queryOne(
    "SELECT id, slug, name FROM brand WHERE slug = $1 AND deleted_at IS NULL AND is_active",
    [slug],
  );
}

/**
 * For every device, the categories that hold a published product fitting it.
 *
 * Feeds the "What are you looking for?" step of the device finder, which may only
 * offer what the shop really stocks for the phone a shopper named. One query for
 * the whole map rather than one per device: the finder filters it in the browser
 * as the shopper changes their mind, so a request per tap would be a request a
 * mobile connection can drop.
 *
 * Accessories that fit no particular device (a power bank) have no compatibility
 * rows by design — ADR 0018 — so they are never in this map, which is exactly why
 * a shopper who named an iPhone is not offered one.
 *
 * Bounded at devices × categories, which is a few thousand rows at the outside;
 * the cap is a backstop, not a limit the shop is expected to meet.
 */
export async function listFittingCategoriesByDevice(): Promise<CategoriesByDevice> {
  const rows = await query<{ device_slug: string; category_slug: string }>(
    `SELECT DISTINCT d.slug AS device_slug, c.slug AS category_slug
       FROM product_compatibility pcm
       JOIN device d ON d.id = pcm.device_id
       JOIN product p ON p.id = pcm.product_id
        AND p.deleted_at IS NULL AND p.status = 'published'
       JOIN product_category pc ON pc.product_id = p.id
       JOIN category c ON c.id = pc.category_id AND c.deleted_at IS NULL AND c.is_active
      LIMIT 20000`,
  );

  const byDevice: Record<string, string[]> = {};
  for (const row of rows) {
    const existing = byDevice[row.device_slug];
    if (existing === undefined) byDevice[row.device_slug] = [row.category_slug];
    else existing.push(row.category_slug);
  }
  return byDevice;
}

/**
 * Every device the catalogue knows about, brand-first and already ordered.
 *
 * Shaped to `DeviceLike` so the matching rules in `domain/device-match` apply to
 * it unchanged, in the browser and on the server alike. The list is small — one
 * row per model the shop stocks for — so the storefront loads it whole and
 * filters it in memory rather than querying on every keystroke.
 */
export type StorefrontDevice = {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  /**
   * The class the model sits in — iPhone, Galaxy Tab — or a typed absence.
   *
   * Optional everywhere it is read. A brand with no classes is not a broken
   * brand, it is a brand nobody has needed to sort yet, and the finder groups
   * only where there is a grouping.
   */
  lineName: string | null;
};

export async function listDevices(): Promise<StorefrontDevice[]> {
  const rows = await query<{
    id: string;
    slug: string;
    name: string;
    brand_name: string;
    line_name: string | null;
  }>(
    // `NULLS FIRST` so a brand's unfiled models lead rather than being stranded
    // after every class — a shop part-way through sorting them still reads.
    `SELECT d.id, d.slug, d.name, b.name AS brand_name, l.name AS line_name
       FROM device d
       JOIN brand b ON b.id = d.brand_id
       LEFT JOIN device_line l ON l.id = d.line_id AND l.deleted_at IS NULL
      WHERE b.deleted_at IS NULL
      ORDER BY b.sort_order, l.sort_order NULLS FIRST, l.name, d.sort_order, d.name`,
  );
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    brandName: row.brand_name,
    lineName: row.line_name,
  }));
}

/**
 * What a product fits, for the product page.
 *
 * "Will this fit my phone" is asked on the product page and, until now, could
 * only be answered by going back to the shop and re-filtering. An empty list is
 * a real answer — a universal pouch fits no named device — so the caller decides
 * what to render rather than being handed a fabricated "fits everything".
 */
export async function listCompatibleDevices(productId: string): Promise<StorefrontDevice[]> {
  const rows = await query<{
    id: string;
    slug: string;
    name: string;
    brand_name: string;
    line_name: string | null;
  }>(
    `SELECT d.id, d.slug, d.name, b.name AS brand_name, l.name AS line_name
       FROM product_compatibility pc
       JOIN device d ON d.id = pc.device_id
       JOIN brand b ON b.id = d.brand_id
       LEFT JOIN device_line l ON l.id = d.line_id AND l.deleted_at IS NULL
      WHERE pc.product_id = $1 AND b.deleted_at IS NULL
      ORDER BY b.sort_order, l.sort_order NULLS FIRST, l.name, d.sort_order, d.name`,
    [productId],
  );
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    brandName: row.brand_name,
    lineName: row.line_name,
  }));
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
