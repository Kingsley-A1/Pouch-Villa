import { createHash, randomBytes } from "node:crypto";
import { query, type Queryable } from "../db/client";
import { withTransaction } from "../db/transaction";
import { addKobo, kobo, multiplyKobo, type Kobo } from "../domain/money";
import { isStorageConfigured } from "../storage/r2";
import { urlsForHash } from "./media-urls";

/**
 * The cart — guest and authenticated, merged on sign-in.
 *
 * **A cart line holds no price.** Price is read live from the variant for as long
 * as the thing is a cart, and frozen only at placement into `order_line`. A cart
 * left open for a week therefore shows today's price rather than a stale one,
 * and a placed order never changes. Getting this backwards is how a customer
 * ends up arguing with a receipt.
 *
 * A guest cart is keyed by an opaque token held in a cookie; only its SHA-256
 * digest is stored, on the same reasoning as a session token — a leaked backup
 * should not hand over someone's cart.
 */

const TOKEN_BYTES = 24;
export const MAX_LINE_QUANTITY = 99;

export function generateCartToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class CartLineLimitError extends Error {
  constructor() {
    super(`You can order at most ${MAX_LINE_QUANTITY} of one item.`);
    this.name = "CartLineLimitError";
  }
}

export class VariantUnavailableError extends Error {
  constructor() {
    super("That option is no longer available.");
    this.name = "VariantUnavailableError";
  }
}

export type CartLine = {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  brandName: string | null;
  variantSku: string;
  axes: Record<string, string>;
  unitPriceKobo: Kobo;
  quantity: number;
  lineTotalKobo: Kobo;
  /** Live stock, so the cart can show what is actually buyable right now. */
  inStock: number;
  imageUrl: string | null;
};

export type Cart = {
  id: string;
  lines: CartLine[];
  subtotalKobo: Kobo;
  itemCount: number;
};

export const EMPTY_CART_TOTALS = { subtotalKobo: kobo(0), itemCount: 0 };

/**
 * Resolves the caller's cart, creating one if needed.
 *
 * A signed-in customer always uses their own cart row; the guest token is only
 * consulted when there is no customer. That ordering matters — otherwise signing
 * in on a shared device would attach a stranger's guest cart to the account.
 */
export async function getOrCreateCart(
  owner: { customerId: string } | { token: string },
): Promise<string> {
  return withTransaction(async (tx) => {
    if ("customerId" in owner) {
      const existing = await tx.query(
        "SELECT id FROM cart WHERE customer_id = $1 AND converted_at IS NULL",
        [owner.customerId],
      );
      const found = existing.rows[0] as { id: string } | undefined;
      if (found !== undefined) return found.id;

      const created = await tx.query("INSERT INTO cart (customer_id) VALUES ($1) RETURNING id", [
        owner.customerId,
      ]);
      return (created.rows[0] as { id: string }).id;
    }

    const tokenHash = hashToken(owner.token);
    const existing = await tx.query(
      "SELECT id FROM cart WHERE token_hash = $1 AND converted_at IS NULL",
      [tokenHash],
    );
    const found = existing.rows[0] as { id: string } | undefined;
    if (found !== undefined) return found.id;

    const created = await tx.query("INSERT INTO cart (token_hash) VALUES ($1) RETURNING id", [
      tokenHash,
    ]);
    return (created.rows[0] as { id: string }).id;
  });
}

/** Finds a cart without creating one — for a page that only needs the count. */
export async function findCartId(
  owner: { customerId: string } | { token: string },
): Promise<string | null> {
  const rows =
    "customerId" in owner
      ? await query<{ id: string }>(
          "SELECT id FROM cart WHERE customer_id = $1 AND converted_at IS NULL",
          [owner.customerId],
        )
      : await query<{ id: string }>(
          "SELECT id FROM cart WHERE token_hash = $1 AND converted_at IS NULL",
          [hashToken(owner.token)],
        );
  return rows[0]?.id ?? null;
}

type CartLineRow = {
  id: string;
  variant_id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  brand_name: string | null;
  variant_sku: string;
  price_kobo: string;
  quantity: string;
  in_stock: string;
  axes: Record<string, string> | null;
  content_hash: string | null;
  r2_key: string | null;
};

/**
 * One round trip for the whole cart. CockroachDB latency is per-statement, and
 * this runs on every page that shows a cart badge.
 *
 * Only published products with an active, undeleted variant are returned. A line
 * whose product was unpublished after it was added simply disappears from the
 * cart rather than blocking checkout with something unbuyable.
 */
export async function readCart(cartId: string): Promise<Cart> {
  const rows = await query<CartLineRow>(
    `SELECT ci.id,
            ci.variant_id,
            p.id   AS product_id,
            p.name AS product_name,
            p.slug AS product_slug,
            b.name AS brand_name,
            v.sku  AS variant_sku,
            v.price_kobo::STRING AS price_kobo,
            ci.quantity::STRING AS quantity,
            coalesce((SELECT sum(se.delta) FROM stock_entry se WHERE se.variant_id = v.id), 0)::STRING
              AS in_stock,
            (SELECT jsonb_object_agg(vv.axis_code, vv.value)
               FROM variant_value vv WHERE vv.variant_id = v.id) AS axes,
            (SELECT pm.content_hash FROM product_media pm
              WHERE pm.product_id = p.id ORDER BY pm.sort_order LIMIT 1) AS content_hash,
            (SELECT pm.r2_key FROM product_media pm
              WHERE pm.product_id = p.id ORDER BY pm.sort_order LIMIT 1) AS r2_key
       FROM cart_item ci
       JOIN product_variant v ON v.id = ci.variant_id AND v.deleted_at IS NULL AND v.is_active
       JOIN product p ON p.id = v.product_id AND p.deleted_at IS NULL AND p.status = 'published'
       LEFT JOIN brand b ON b.id = p.brand_id
      WHERE ci.cart_id = $1
      ORDER BY ci.added_at`,
    [cartId],
  );

  const lines = rows.map((row): CartLine => {
    const unitPriceKobo = kobo(Number(row.price_kobo));
    const quantity = Number(row.quantity);
    return {
      id: row.id,
      variantId: row.variant_id,
      productId: row.product_id,
      productName: row.product_name,
      productSlug: row.product_slug,
      brandName: row.brand_name,
      variantSku: row.variant_sku,
      axes: row.axes ?? {},
      unitPriceKobo,
      quantity,
      lineTotalKobo: multiplyKobo(unitPriceKobo, quantity),
      inStock: Number(row.in_stock),
      imageUrl:
        isStorageConfigured() && row.r2_key !== null
          ? urlsForHash(row.product_id, row.content_hash, row.r2_key).thumb
          : null,
    };
  });

  return {
    id: cartId,
    lines,
    subtotalKobo: addKobo(...lines.map((line) => line.lineTotalKobo)),
    itemCount: lines.reduce((total, line) => total + line.quantity, 0),
  };
}

/**
 * Adds to the cart, or increases an existing line.
 *
 * The upsert is a single statement so it is safe under a transaction retry — a
 * read-then-write would double the quantity if the body ran twice.
 */
export async function addToCart(cartId: string, variantId: string, quantity = 1): Promise<void> {
  if (quantity < 1 || quantity > MAX_LINE_QUANTITY) throw new CartLineLimitError();

  await withTransaction(async (tx) => {
    const buyable = await tx.query(
      `SELECT v.id
         FROM product_variant v
         JOIN product p ON p.id = v.product_id
        WHERE v.id = $1
          AND v.deleted_at IS NULL AND v.is_active
          AND p.deleted_at IS NULL AND p.status = 'published'`,
      [variantId],
    );
    if (buyable.rows.length === 0) throw new VariantUnavailableError();

    await tx.query(
      `INSERT INTO cart_item (cart_id, variant_id, quantity)
            VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, variant_id) DO UPDATE
            SET quantity = least(cart_item.quantity + excluded.quantity, $4)`,
      [cartId, variantId, quantity, MAX_LINE_QUANTITY],
    );
    await tx.query("UPDATE cart SET updated_at = now() WHERE id = $1", [cartId]);
  });
}

export async function setCartLineQuantity(
  cartId: string,
  variantId: string,
  quantity: number,
): Promise<void> {
  if (quantity < 0 || quantity > MAX_LINE_QUANTITY) throw new CartLineLimitError();

  if (quantity === 0) {
    await removeFromCart(cartId, variantId);
    return;
  }

  await withTransaction(async (tx) => {
    await tx.query("UPDATE cart_item SET quantity = $3 WHERE cart_id = $1 AND variant_id = $2", [
      cartId,
      variantId,
      quantity,
    ]);
    await tx.query("UPDATE cart SET updated_at = now() WHERE id = $1", [cartId]);
  });
}

export async function removeFromCart(cartId: string, variantId: string): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.query("DELETE FROM cart_item WHERE cart_id = $1 AND variant_id = $2", [
      cartId,
      variantId,
    ]);
    await tx.query("UPDATE cart SET updated_at = now() WHERE id = $1", [cartId]);
  });
}

export async function clearCart(tx: Queryable, cartId: string): Promise<void> {
  await tx.query("DELETE FROM cart_item WHERE cart_id = $1", [cartId]);
}

/**
 * Merges a guest cart into the customer's own on sign-in.
 *
 * Quantities are **added**, not replaced, and capped at the line limit: someone
 * who put two of something in on their phone and one on their laptop expects
 * three, not to silently lose one. The guest cart row is marked converted rather
 * than deleted, so nothing is hard-deleted and the merge is auditable.
 *
 * Returns the customer's cart id.
 */
export async function mergeGuestCart(token: string, customerId: string): Promise<string> {
  const tokenHash = hashToken(token);

  return withTransaction(async (tx) => {
    const guestRows = await tx.query(
      "SELECT id FROM cart WHERE token_hash = $1 AND converted_at IS NULL",
      [tokenHash],
    );
    const guest = guestRows.rows[0] as { id: string } | undefined;

    const ownRows = await tx.query(
      "SELECT id FROM cart WHERE customer_id = $1 AND converted_at IS NULL",
      [customerId],
    );
    let ownId = (ownRows.rows[0] as { id: string } | undefined)?.id;

    if (ownId === undefined) {
      const created = await tx.query("INSERT INTO cart (customer_id) VALUES ($1) RETURNING id", [
        customerId,
      ]);
      ownId = (created.rows[0] as { id: string }).id;
    }

    if (guest === undefined || guest.id === ownId) return ownId;

    await tx.query(
      `INSERT INTO cart_item (cart_id, variant_id, quantity)
            SELECT $2, gi.variant_id, gi.quantity FROM cart_item gi WHERE gi.cart_id = $1
       ON CONFLICT (cart_id, variant_id) DO UPDATE
            SET quantity = least(cart_item.quantity + excluded.quantity, $3)`,
      [guest.id, ownId, MAX_LINE_QUANTITY],
    );
    await tx.query("DELETE FROM cart_item WHERE cart_id = $1", [guest.id]);
    await tx.query("UPDATE cart SET converted_at = now() WHERE id = $1", [guest.id]);
    await tx.query("UPDATE cart SET updated_at = now() WHERE id = $1", [ownId]);

    return ownId;
  });
}

/**
 * Abandoned guest carts are rubbish after a while. A customer's cart is left
 * alone — it is part of their account, and someone returning after a month
 * expects to find what they left.
 */
export async function sweepAbandonedCarts(olderThanDays = 30): Promise<number> {
  const rows = await query<{ id: string }>(
    `DELETE FROM cart
      WHERE token_hash IS NOT NULL
        AND converted_at IS NULL
        AND updated_at < now() - ($1 || ' days')::INTERVAL
      RETURNING id`,
    [String(olderThanDays)],
  );
  return rows.length;
}

/**
 * The header badge's count, in **one** indexed query rather than a find-then-count
 * pair.
 *
 * This runs on every page that renders the store header, and a query against
 * this CockroachDB cluster costs 2-3s even warm (see the work plan's risk
 * table), so halving the round trips here is worth the slightly denser SQL.
 * Only published, buyable lines are counted, so the badge never promises
 * something checkout would then drop.
 */
export async function countCartItems(
  owner: { customerId: string } | { token: string },
): Promise<number> {
  const ownerClause = "customerId" in owner ? "c.customer_id = $1" : "c.token_hash = $1";
  const subject = "customerId" in owner ? owner.customerId : hashToken(owner.token);

  const rows = await query<{ total: string }>(
    `SELECT coalesce(sum(ci.quantity), 0)::STRING AS total
       FROM cart c
       JOIN cart_item ci ON ci.cart_id = c.id
       JOIN product_variant v ON v.id = ci.variant_id AND v.deleted_at IS NULL AND v.is_active
       JOIN product p ON p.id = v.product_id AND p.deleted_at IS NULL AND p.status = 'published'
      WHERE ${ownerClause} AND c.converted_at IS NULL`,
    [subject],
  );
  return Number(rows[0]?.total ?? 0);
}
