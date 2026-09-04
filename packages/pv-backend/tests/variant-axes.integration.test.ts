import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { closePool, query } from "../src/db/client";
import { writableTestDatabaseConfigured } from "./helpers/database";
import { getPublishedProductBySlug, listVariants } from "../src/services/catalogue";
import { addToCart, getOrCreateCart, readCart } from "../src/services/cart";

/**
 * A variant with no axes must not take the product page down.
 *
 * It did. Since a variant became optional at upload, a product could be saved
 * with a variant carrying no colour or size, and the correlated
 * `jsonb_object_agg` that read the axes then failed the entire statement with
 * `null value not allowed for object key` — CockroachDB decorrelates the
 * subquery and feeds the aggregate a NULL-extended row where PostgreSQL would
 * aggregate an empty set. The product page, the cart and checkout all 500'd for
 * that product, and the admin did not, because it assembles axes in TypeScript.
 *
 * These run against a real cluster because the defect exists only in a real
 * cluster: the query is valid SQL, the schema forbids a NULL `axis_code`, and no
 * mock reproduces the optimiser's rewrite. See `src/db/variant-axes.ts`.
 */
const describeDb = writableTestDatabaseConfigured() ? describe : describe.skip;

const products: string[] = [];
const carts: string[] = [];

/** A published product whose single variant has no axis rows at all. */
async function publishProductWithAxislessVariant(): Promise<{
  slug: string;
  productId: string;
  variantId: string;
}> {
  const slug = `zz-axisless-${randomUUID()}`;
  const productRows = await query<{ id: string }>(
    `INSERT INTO product (slug, name, status, published_at)
          VALUES ($1, $2, 'published', now()) RETURNING id`,
    [slug, "ZZ Axisless Pouch"],
  );
  const productId = productRows[0]!.id;
  products.push(productId);

  const variantRows = await query<{ id: string }>(
    `INSERT INTO product_variant (product_id, sku, price_kobo)
          VALUES ($1, $2, $3) RETURNING id`,
    [productId, `ZZ-AX-${randomUUID().slice(0, 8).toUpperCase()}`, 750000],
  );
  const variantId = variantRows[0]!.id;
  await query("INSERT INTO stock_entry (variant_id, delta, reason) VALUES ($1, $2, 'received')", [
    variantId,
    5,
  ]);
  return { slug, productId, variantId };
}

describeDb("a variant with no axes", () => {
  let axisless: { slug: string; productId: string; variantId: string };

  beforeAll(async () => {
    axisless = await publishProductWithAxislessVariant();
  }, 120_000);

  afterAll(async () => {
    for (const cartId of carts) await query("DELETE FROM cart WHERE id = $1", [cartId]);
    for (const productId of products) {
      await query("DELETE FROM product WHERE id = $1", [productId]);
    }
    await closePool();
  }, 120_000);

  it("reads back as an empty set of axes rather than failing the query", async () => {
    const variants = await listVariants(axisless.productId);
    expect(variants).toHaveLength(1);
    expect(variants[0]?.axes).toEqual({});
    expect(variants[0]?.inStock).toBe(5);
  }, 120_000);

  it("does not stop the product page loading", async () => {
    const product = await getPublishedProductBySlug(axisless.slug);
    expect(product?.name).toBe("ZZ Axisless Pouch");
    expect(product?.variants).toHaveLength(1);
  }, 120_000);

  /**
   * The same aggregate reads a cart line, and a cart mixing an axis-less variant
   * with one that has axes is the case the decorrelation actually broke: one row
   * without axes failed the whole statement, so the other line vanished too.
   */
  it("does not stop a cart containing it from being read", async () => {
    const cartId = await getOrCreateCart({ token: `zz-axisless-${randomUUID()}` });
    carts.push(cartId);
    await addToCart(cartId, axisless.variantId, 2);

    // `colour` is seeded by migration 0003, so the axis already exists.
    const withAxes = await publishProductWithAxislessVariant();
    await query("INSERT INTO variant_value (variant_id, axis_code, value) VALUES ($1, $2, $3)", [
      withAxes.variantId,
      "colour",
      "Black",
    ]);
    await addToCart(cartId, withAxes.variantId, 1);

    const cart = await readCart(cartId);
    expect(cart.lines).toHaveLength(2);
    const byVariant = new Map(cart.lines.map((line) => [line.variantId, line.axes]));
    expect(byVariant.get(axisless.variantId)).toEqual({});
    expect(byVariant.get(withAxes.variantId)).toEqual({ colour: "Black" });
  }, 180_000);
});
