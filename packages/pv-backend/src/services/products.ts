import { getPool, query, queryOne } from "../db/client";
import { withTransaction } from "../db/transaction";
import { kobo, type Kobo } from "../domain/money";
import { recordAudit } from "./audit";

/**
 * Admin-side product and variant management. Every mutation is a single
 * transaction with its audit record, and nothing is ever hard-deleted — a
 * soft-deleted product keeps its history and can be restored.
 */

export type ProductStatus = "draft" | "published" | "unpublished" | "archived";

export type AdminProductSummary = {
  id: string;
  slug: string;
  name: string;
  status: ProductStatus;
  brandName: string | null;
  variantCount: number;
  inStock: number;
};

type SummaryRow = {
  id: string;
  slug: string;
  name: string;
  status: ProductStatus;
  brand_name: string | null;
  variant_count: string;
  in_stock: string;
};

export async function listAllProducts(filters: { status?: ProductStatus } = {}) {
  const conditions = ["p.deleted_at IS NULL"];
  const values: unknown[] = [];
  if (filters.status) {
    values.push(filters.status);
    conditions.push(`p.status = $${values.length}`);
  }
  const rows = await query<SummaryRow>(
    `SELECT p.id, p.slug, p.name, p.status, b.name AS brand_name,
            (SELECT count(*) FROM product_variant v WHERE v.product_id = p.id AND v.deleted_at IS NULL)::STRING AS variant_count,
            (SELECT coalesce(sum(se.delta), 0)
               FROM stock_entry se JOIN product_variant v ON v.id = se.variant_id
              WHERE v.product_id = p.id AND v.deleted_at IS NULL)::STRING AS in_stock
       FROM product p
       LEFT JOIN brand b ON b.id = p.brand_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY p.updated_at DESC
      LIMIT 200`,
    values,
  );
  return rows.map((row): AdminProductSummary => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    brandName: row.brand_name,
    variantCount: Number(row.variant_count),
    inStock: Number(row.in_stock),
  }));
}

export type AdminVariant = {
  id: string;
  sku: string;
  priceKobo: Kobo;
  compareAtKobo: Kobo | null;
  isActive: boolean;
  sortOrder: number;
  inStock: number;
  axes: Record<string, string>;
};

export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string | null;
  brandId: string | null;
  status: ProductStatus;
  categoryIds: string[];
  deviceIds: string[];
  variants: AdminVariant[];
};

export async function getProductForEdit(id: string): Promise<AdminProduct | null> {
  const product = await queryOne<{
    id: string;
    slug: string;
    name: string;
    summary: string | null;
    description: string | null;
    brand_id: string | null;
    status: ProductStatus;
  }>(
    `SELECT id, slug, name, summary, description, brand_id, status
       FROM product WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  if (product === null) return null;

  const [categories, devices, variantRows] = await Promise.all([
    query<{ category_id: string }>(
      "SELECT category_id FROM product_category WHERE product_id = $1",
      [id],
    ),
    query<{ device_id: string }>(
      "SELECT device_id FROM product_compatibility WHERE product_id = $1",
      [id],
    ),
    query<{
      id: string;
      sku: string;
      price_kobo: number;
      compare_at_kobo: number | null;
      is_active: boolean;
      sort_order: number;
      in_stock: string;
      axes: Record<string, string> | null;
    }>(
      `SELECT v.id, v.sku, v.price_kobo, v.compare_at_kobo, v.is_active, v.sort_order,
              (SELECT coalesce(sum(se.delta), 0)::STRING FROM stock_entry se WHERE se.variant_id = v.id) AS in_stock,
              (SELECT jsonb_object_agg(vv.axis_code, vv.value) FROM variant_value vv WHERE vv.variant_id = v.id) AS axes
         FROM product_variant v
        WHERE v.product_id = $1 AND v.deleted_at IS NULL
        ORDER BY v.sort_order, v.sku`,
      [id],
    ),
  ]);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    summary: product.summary,
    description: product.description,
    brandId: product.brand_id,
    status: product.status,
    categoryIds: categories.map((row) => row.category_id),
    deviceIds: devices.map((row) => row.device_id),
    variants: variantRows.map((row) => ({
      id: row.id,
      sku: row.sku,
      priceKobo: kobo(row.price_kobo),
      compareAtKobo: row.compare_at_kobo === null ? null : kobo(row.compare_at_kobo),
      isActive: row.is_active,
      sortOrder: row.sort_order,
      inStock: Number(row.in_stock),
      axes: row.axes ?? {},
    })),
  };
}

export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`The slug "${slug}" is already in use.`);
    this.name = "SlugTakenError";
  }
}

export type ProductInput = {
  name: string;
  slug: string;
  summary: string | null;
  description: string | null;
  brandId: string | null;
  categoryIds: string[];
  deviceIds: string[];
};

export async function createProduct(input: ProductInput, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    const clash = await tx.query("SELECT id FROM product WHERE slug = $1 AND deleted_at IS NULL", [
      input.slug,
    ]);
    if (clash.rows.length > 0) throw new SlugTakenError(input.slug);

    const result = await tx.query(
      `INSERT INTO product (name, slug, summary, description, brand_id, status, created_by, updated_by)
            VALUES ($1, $2, $3, $4, $5, 'draft', $6, $6)
         RETURNING id`,
      [input.name, input.slug, input.summary, input.description, input.brandId, actor.staffId],
    );
    const id = (result.rows[0] as { id: string }).id;

    for (const categoryId of input.categoryIds) {
      await tx.query("INSERT INTO product_category (product_id, category_id) VALUES ($1, $2)", [
        id,
        categoryId,
      ]);
    }
    for (const deviceId of input.deviceIds) {
      await tx.query("INSERT INTO product_compatibility (product_id, device_id) VALUES ($1, $2)", [
        id,
        deviceId,
      ]);
    }

    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "product.created",
      entityType: "product",
      entityId: id,
      after: input,
    });
    return id;
  });
}

export async function updateProduct(id: string, input: ProductInput, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    const before = await tx.query(
      "SELECT name, slug, summary, description, brand_id FROM product WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    if (before.rows.length === 0) return false;

    const clash = await tx.query(
      "SELECT id FROM product WHERE slug = $1 AND id <> $2 AND deleted_at IS NULL",
      [input.slug, id],
    );
    if (clash.rows.length > 0) throw new SlugTakenError(input.slug);

    await tx.query(
      `UPDATE product
          SET name = $2, slug = $3, summary = $4, description = $5, brand_id = $6,
              updated_at = now(), updated_by = $7
        WHERE id = $1`,
      [id, input.name, input.slug, input.summary, input.description, input.brandId, actor.staffId],
    );

    await tx.query("DELETE FROM product_category WHERE product_id = $1", [id]);
    for (const categoryId of input.categoryIds) {
      await tx.query("INSERT INTO product_category (product_id, category_id) VALUES ($1, $2)", [
        id,
        categoryId,
      ]);
    }

    await tx.query("DELETE FROM product_compatibility WHERE product_id = $1", [id]);
    for (const deviceId of input.deviceIds) {
      await tx.query("INSERT INTO product_compatibility (product_id, device_id) VALUES ($1, $2)", [
        id,
        deviceId,
      ]);
    }

    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "product.updated",
      entityType: "product",
      entityId: id,
      before: before.rows[0],
      after: input,
    });
    return true;
  });
}

export class CannotPublishEmptyProductError extends Error {
  constructor() {
    super("A product needs at least one active, priced variant before it can be published.");
    this.name = "CannotPublishEmptyProductError";
  }
}

export async function setProductStatus(
  id: string,
  status: ProductStatus,
  actor: { staffId: string },
) {
  return withTransaction(async (tx) => {
    if (status === "published") {
      const active = await tx.query(
        "SELECT id FROM product_variant WHERE product_id = $1 AND deleted_at IS NULL AND is_active LIMIT 1",
        [id],
      );
      if (active.rows.length === 0) throw new CannotPublishEmptyProductError();
    }

    const before = await tx.query("SELECT status FROM product WHERE id = $1", [id]);
    if (before.rows.length === 0) return false;

    await tx.query(
      `UPDATE product
          SET status = $2, updated_at = now(), updated_by = $3,
              published_at = CASE WHEN $2 = 'published' AND published_at IS NULL THEN now() ELSE published_at END
        WHERE id = $1`,
      [id, status, actor.staffId],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "product.status_changed",
      entityType: "product",
      entityId: id,
      before: before.rows[0],
      after: { status },
    });
    return true;
  });
}

export async function softDeleteProduct(id: string, reason: string, actor: { staffId: string }) {
  await query(
    "UPDATE product SET deleted_at = now(), deleted_by = $2, deleted_reason = $3, status = 'archived' WHERE id = $1",
    [id, actor.staffId, reason],
  );
  await recordAudit(getPool(), {
    actorType: "staff",
    actorId: actor.staffId,
    action: "product.deleted",
    entityType: "product",
    entityId: id,
    after: { reason },
  });
}

export async function restoreProduct(id: string, actor: { staffId: string }) {
  await query(
    "UPDATE product SET deleted_at = NULL, deleted_by = NULL, deleted_reason = NULL, status = 'draft' WHERE id = $1",
    [id],
  );
  await recordAudit(getPool(), {
    actorType: "staff",
    actorId: actor.staffId,
    action: "product.restored",
    entityType: "product",
    entityId: id,
  });
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export class SkuTakenError extends Error {
  constructor(sku: string) {
    super(`The SKU "${sku}" is already in use.`);
    this.name = "SkuTakenError";
  }
}

export type VariantInput = {
  sku: string;
  priceKobo: Kobo;
  compareAtKobo: Kobo | null;
  sortOrder: number;
  axes: Record<string, string>;
};

async function setVariantAxisValues(
  tx: { query: (text: string, values?: readonly unknown[]) => Promise<{ rows: unknown[] }> },
  variantId: string,
  axes: Record<string, string>,
) {
  await tx.query("DELETE FROM variant_value WHERE variant_id = $1", [variantId]);
  for (const [axisCode, value] of Object.entries(axes)) {
    if (!value) continue;
    await tx.query("INSERT INTO variant_value (variant_id, axis_code, value) VALUES ($1, $2, $3)", [
      variantId,
      axisCode,
      value,
    ]);
  }
}

export async function createVariant(
  productId: string,
  input: VariantInput,
  actor: { staffId: string },
) {
  return withTransaction(async (tx) => {
    const clash = await tx.query(
      "SELECT id FROM product_variant WHERE sku = $1 AND deleted_at IS NULL",
      [input.sku],
    );
    if (clash.rows.length > 0) throw new SkuTakenError(input.sku);

    const result = await tx.query(
      `INSERT INTO product_variant (product_id, sku, price_kobo, compare_at_kobo, sort_order)
            VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
      [productId, input.sku, input.priceKobo, input.compareAtKobo, input.sortOrder],
    );
    const id = (result.rows[0] as { id: string }).id;
    await setVariantAxisValues(tx, id, input.axes);

    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "variant.created",
      entityType: "product_variant",
      entityId: id,
      after: input,
    });
    return id;
  });
}

export async function updateVariant(id: string, input: VariantInput, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    const before = await tx.query(
      "SELECT sku, price_kobo, compare_at_kobo, sort_order FROM product_variant WHERE id = $1",
      [id],
    );
    if (before.rows.length === 0) return false;

    const clash = await tx.query(
      "SELECT id FROM product_variant WHERE sku = $1 AND id <> $2 AND deleted_at IS NULL",
      [input.sku, id],
    );
    if (clash.rows.length > 0) throw new SkuTakenError(input.sku);

    await tx.query(
      `UPDATE product_variant
          SET sku = $2, price_kobo = $3, compare_at_kobo = $4, sort_order = $5, updated_at = now()
        WHERE id = $1`,
      [id, input.sku, input.priceKobo, input.compareAtKobo, input.sortOrder],
    );
    await setVariantAxisValues(tx, id, input.axes);

    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "variant.updated",
      entityType: "product_variant",
      entityId: id,
      before: before.rows[0],
      after: input,
    });
    return true;
  });
}

export async function setVariantActive(id: string, isActive: boolean, actor: { staffId: string }) {
  await query("UPDATE product_variant SET is_active = $2, updated_at = now() WHERE id = $1", [
    id,
    isActive,
  ]);
  await recordAudit(getPool(), {
    actorType: "staff",
    actorId: actor.staffId,
    action: isActive ? "variant.activated" : "variant.deactivated",
    entityType: "product_variant",
    entityId: id,
  });
}

export async function softDeleteVariant(id: string, actor: { staffId: string }) {
  await query("UPDATE product_variant SET deleted_at = now(), updated_at = now() WHERE id = $1", [
    id,
  ]);
  await recordAudit(getPool(), {
    actorType: "staff",
    actorId: actor.staffId,
    action: "variant.deleted",
    entityType: "product_variant",
    entityId: id,
  });
}

// ---------------------------------------------------------------------------
// Stock ledger
// ---------------------------------------------------------------------------

export type StockReason =
  "received" | "sold" | "returned" | "adjustment" | "damaged" | "reserved" | "released";

const NEGATIVE_REASONS: readonly StockReason[] = ["sold", "damaged", "reserved"];
const POSITIVE_REASONS: readonly StockReason[] = ["received", "returned", "released"];

export class InvalidStockDeltaError extends Error {
  constructor(reason: StockReason) {
    super(`A "${reason}" stock entry must not have that sign.`);
    this.name = "InvalidStockDeltaError";
  }
}

/** Stock is a ledger, never a mutated counter — the sum is always the truth. */
export async function adjustStock(
  variantId: string,
  delta: number,
  reason: StockReason,
  note: string | null,
  actor: { staffId: string },
) {
  if (NEGATIVE_REASONS.includes(reason) && delta >= 0) throw new InvalidStockDeltaError(reason);
  if (POSITIVE_REASONS.includes(reason) && delta <= 0) throw new InvalidStockDeltaError(reason);
  if (delta === 0) throw new InvalidStockDeltaError(reason);

  return withTransaction(async (tx) => {
    const result = await tx.query(
      `INSERT INTO stock_entry (variant_id, delta, reason, note, actor_id)
            VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
      [variantId, delta, reason, note, actor.staffId],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "stock.adjusted",
      entityType: "product_variant",
      entityId: variantId,
      after: { delta, reason, note },
    });
    return (result.rows[0] as { id: string }).id;
  });
}

export async function listStockHistory(variantId: string) {
  return query<{
    id: string;
    delta: number;
    reason: StockReason;
    note: string | null;
    occurred_at: Date;
  }>(
    `SELECT id, delta, reason, note, occurred_at
       FROM stock_entry WHERE variant_id = $1
      ORDER BY occurred_at DESC LIMIT 100`,
    [variantId],
  );
}
