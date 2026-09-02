import { createHash, randomBytes } from "node:crypto";
import { query, queryOne } from "../db/client";
import { withTransaction } from "../db/transaction";
import { listPublishedProductsByIds, type CatalogueListItem } from "./catalogue";

/**
 * Product likes — the scope's "like & share", which the prototype never had.
 *
 * A like is attributable to exactly one actor: a signed-in customer, or a
 * signed-out visitor holding an opaque cookie. Supporting both is the point.
 * Requiring an account would measure almost nothing on a shop whose visitors are
 * overwhelmingly signed out, and the signed-out like is what a shopper uses as a
 * shortlist while they decide.
 *
 * Only the digest of the visitor token is stored, never the token, so a database
 * reader cannot forge the cookie that produced a row — the same treatment
 * sessions and cart tokens already get.
 */

export type LikeActor = { customerId: string } | { visitorToken: string };

export function generateVisitorToken(): string {
  return randomBytes(32).toString("base64url");
}

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Splits an actor into the two columns, exactly one of which is set. Returning
 * both makes every query below a single shape rather than a branch per call.
 */
function columnsFor(actor: LikeActor): { customerId: string | null; visitorKey: string | null } {
  return "customerId" in actor
    ? { customerId: actor.customerId, visitorKey: null }
    : { customerId: null, visitorKey: digest(actor.visitorToken) };
}

export type LikeState = { liked: boolean; count: number };

/**
 * Likes or unlikes, and returns the state the button should now show.
 *
 * The insert leans on the partial unique indexes rather than a read-then-write:
 * under serializable isolation, "check whether they liked it, then insert" is a
 * race that a double-tapped button on a slow connection will find. `ON CONFLICT
 * DO NOTHING` reports through `rowCount` whether the row was new, which is also
 * what tells us the toggle direction without a second round trip.
 *
 * The body is safe to run twice, as every CockroachDB transaction body must be.
 */
export async function toggleLike(productId: string, actor: LikeActor): Promise<LikeState> {
  const { customerId, visitorKey } = columnsFor(actor);

  return withTransaction(async (tx) => {
    const inserted = await tx.query(
      `INSERT INTO product_like (product_id, customer_id, visitor_key)
       SELECT $1, $2, $3
        WHERE EXISTS (
          SELECT 1 FROM product
           WHERE id = $1 AND deleted_at IS NULL AND status = 'published'
        )
       ON CONFLICT DO NOTHING`,
      [productId, customerId, visitorKey],
    );

    // The driver types rowCount as nullable for statements that do not report
    // one; an INSERT always does, and treating an absent count as zero keeps the
    // fallback on the safe side — it re-reads the truth from the count below.
    const added = (inserted.rowCount ?? 0) > 0;

    // Nothing inserted means either they had already liked it — so this tap is
    // an unlike — or the product is not likeable, in which case the delete finds
    // nothing and the count below reports the truth either way.
    if (!added) {
      await tx.query(
        `DELETE FROM product_like
          WHERE product_id = $1
            AND customer_id IS NOT DISTINCT FROM $2
            AND visitor_key IS NOT DISTINCT FROM $3`,
        [productId, customerId, visitorKey],
      );
    }

    const counted = await tx.query(
      "SELECT count(*)::STRING AS total FROM product_like WHERE product_id = $1",
      [productId],
    );
    const total = Number((counted.rows[0] as { total: string } | undefined)?.total ?? 0);
    return { liked: added, count: total };
  });
}

export async function countLikes(productId: string): Promise<number> {
  const row = await queryOne<{ total: string }>(
    "SELECT count(*)::STRING AS total FROM product_like WHERE product_id = $1",
    [productId],
  );
  return Number(row?.total ?? 0);
}

export async function hasLiked(productId: string, actor: LikeActor): Promise<boolean> {
  const { customerId, visitorKey } = columnsFor(actor);
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM product_like
      WHERE product_id = $1
        AND customer_id IS NOT DISTINCT FROM $2
        AND visitor_key IS NOT DISTINCT FROM $3`,
    [productId, customerId, visitorKey],
  );
  return row !== null;
}

/**
 * Counts for a whole grid in one round trip.
 *
 * A card per query would be an N+1 on the busiest page in the shop, against a
 * cluster where a warm query still costs 2–3s (work-plan §6).
 */
export async function likeCountsFor(productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const rows = await query<{ product_id: string; total: string }>(
    `SELECT product_id, count(*)::STRING AS total
       FROM product_like
      WHERE product_id = ANY($1::UUID[])
      GROUP BY product_id`,
    [productIds],
  );
  return new Map(rows.map((row) => [row.product_id, Number(row.total)]));
}

/** Which of these products the current actor has already liked. */
export async function likedIdsFor(productIds: string[], actor: LikeActor): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();
  const { customerId, visitorKey } = columnsFor(actor);
  const rows = await query<{ product_id: string }>(
    `SELECT product_id FROM product_like
      WHERE product_id = ANY($1::UUID[])
        AND customer_id IS NOT DISTINCT FROM $2
        AND visitor_key IS NOT DISTINCT FROM $3`,
    [productIds, customerId, visitorKey],
  );
  return new Set(rows.map((row) => row.product_id));
}

/** The profile's saved list. Newest first, which is the order it was built in. */
export async function listLikedProducts(
  customerId: string,
  limit = 60,
): Promise<CatalogueListItem[]> {
  const rows = await query<{ product_id: string }>(
    `SELECT product_id FROM product_like
      WHERE customer_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [customerId, limit],
  );
  return listPublishedProductsByIds(rows.map((row) => row.product_id));
}

/**
 * Carries a signed-out visitor's likes into their account on sign-in.
 *
 * Without this, liking three products and then registering silently empties the
 * list — the same complaint that made the prototype's localStorage saved-items
 * worth replacing. A product already liked under both identities collapses to
 * one row rather than raising a unique violation.
 */
export async function mergeVisitorLikes(visitorToken: string, customerId: string): Promise<void> {
  const visitorKey = digest(visitorToken);
  await withTransaction(async (tx) => {
    await tx.query(
      `INSERT INTO product_like (product_id, customer_id)
       SELECT product_id, $2 FROM product_like WHERE visitor_key = $1
       ON CONFLICT DO NOTHING`,
      [visitorKey, customerId],
    );
    await tx.query("DELETE FROM product_like WHERE visitor_key = $1", [visitorKey]);
  });
}
