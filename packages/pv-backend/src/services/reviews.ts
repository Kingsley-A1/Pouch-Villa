import { query, queryOne } from "../db/client";
import { withTransaction } from "../db/transaction";
import { normalisePhone } from "../domain/phone";
import { recordAudit } from "./audit";
import { assertWithinRateLimit, recordRateLimitHits } from "./rate-limit";

/**
 * Reviews.
 *
 * Per the client's Q9 answer and ADR 0005: **anyone may review** — no account, no
 * sign-in wall — and **every review is held for approval** before publication.
 * Q2 pushes the same way: a review should be completable from a modal without
 * being sent to a separate page first.
 *
 * That combination is only safe because of what it implies, so it is worth being
 * explicit: an unapproved review is invisible to everyone except staff, so the
 * cost of a spam submission is one moderation click and nothing reaches the
 * storefront unread. Rate limiting keeps the queue itself from being flooded.
 */

export const MIN_RATING = 1;
export const MAX_RATING = 5;

export class InvalidRatingError extends Error {
  constructor() {
    super(`Choose a rating between ${MIN_RATING} and ${MAX_RATING} stars.`);
    this.name = "InvalidRatingError";
  }
}

export class ProductNotReviewableError extends Error {
  constructor() {
    super("That product is not available to review.");
    this.name = "ProductNotReviewableError";
  }
}

export class ReviewNotFoundError extends Error {
  constructor() {
    super("That review was not found.");
    this.name = "ReviewNotFoundError";
  }
}

export type SubmitReviewInput = {
  productId: string;
  authorName: string;
  authorEmail?: string | null;
  authorPhone?: string | null;
  rating: number;
  title?: string | null;
  body: string;
  /** Present only when the reviewer happened to be signed in. Never required. */
  customerId?: string | null;
};

export type SubmittedReview = { reviewId: string; verifiedPurchase: boolean };

export async function submitReview(
  input: SubmitReviewInput,
  context: { ip?: string | undefined; requestId?: string | undefined } = {},
): Promise<SubmittedReview> {
  if (!Number.isInteger(input.rating) || input.rating < MIN_RATING || input.rating > MAX_RATING) {
    throw new InvalidRatingError();
  }

  const subjects = [context.ip, `${context.ip ?? "anon"}:${input.productId}`];
  await assertWithinRateLimit("review.submit", subjects);

  const email = input.authorEmail?.trim().toLowerCase() ?? null;
  const phone = input.authorPhone ? normalisePhone(input.authorPhone) : null;

  return withTransaction(async (tx) => {
    const product = await tx.query(
      "SELECT id FROM product WHERE id = $1 AND deleted_at IS NULL AND status = 'published'",
      [input.productId],
    );
    if (product.rows.length === 0) throw new ProductNotReviewableError();

    /**
     * The verified-purchase flag is computed once, here, and stored. Recomputing
     * it on read would let an order placed later retroactively change what a
     * published review means.
     *
     * It is a moderator's aid in V1, not a storefront badge, and never a
     * precondition for publishing.
     */
    const matched = await tx.query(
      `SELECT ol.id
         FROM order_line ol
         JOIN customer_order o ON o.id = ol.order_id
        WHERE ol.product_id = $1
          AND o.status = 'completed'
          AND o.deleted_at IS NULL
          AND (($2::STRING IS NOT NULL AND o.contact_email = $2)
            OR ($3::STRING IS NOT NULL AND o.contact_phone = $3)
            OR ($4::UUID   IS NOT NULL AND o.customer_id  = $4))
        LIMIT 1`,
      [input.productId, email, phone, input.customerId ?? null],
    );
    const orderLineId = (matched.rows[0] as { id: string } | undefined)?.id ?? null;

    const inserted = await tx.query(
      `INSERT INTO review
         (product_id, customer_id, order_line_id, author_name, author_email, rating, title, body,
          verified_purchase, status, submitted_ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
       RETURNING id`,
      [
        input.productId,
        input.customerId ?? null,
        orderLineId,
        input.authorName.trim(),
        email,
        input.rating,
        input.title?.trim() || null,
        input.body.trim(),
        orderLineId !== null,
        context.ip ?? null,
      ],
    );
    const reviewId = (inserted.rows[0] as { id: string }).id;

    await recordRateLimitHits("review.submit", subjects, tx);

    await recordAudit(tx, {
      actorType: input.customerId ? "customer" : "system",
      actorId: input.customerId ?? null,
      action: "review.submitted",
      entityType: "review",
      entityId: reviewId,
      after: {
        productId: input.productId,
        rating: input.rating,
        verifiedPurchase: orderLineId !== null,
      },
      requestId: context.requestId,
      ip: context.ip,
    });

    return { reviewId, verifiedPurchase: orderLineId !== null };
  });
}

export type PublishedReview = {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  submittedAt: Date;
};

/**
 * The storefront read. Only approved, undeleted reviews, and deliberately
 * without the reviewer's email or IP — neither is ever rendered.
 */
export async function listApprovedReviews(
  productId: string,
  limit = 50,
): Promise<PublishedReview[]> {
  const rows = await query<{
    id: string;
    author_name: string;
    rating: string;
    title: string | null;
    body: string;
    verified_purchase: boolean;
    submitted_at: Date;
  }>(
    `SELECT id, author_name, rating::STRING AS rating, title, body, verified_purchase, submitted_at
       FROM review
      WHERE product_id = $1 AND status = 'approved' AND deleted_at IS NULL
      ORDER BY submitted_at DESC
      LIMIT $2`,
    [productId, limit],
  );
  return rows.map((row) => ({
    id: row.id,
    authorName: row.author_name,
    rating: Number(row.rating),
    title: row.title,
    body: row.body,
    verifiedPurchase: row.verified_purchase,
    submittedAt: row.submitted_at,
  }));
}

export type RatingSummary = { average: number | null; count: number };

export async function getRatingSummary(productId: string): Promise<RatingSummary> {
  const row = await queryOne<{ average: string | null; total: string }>(
    `SELECT avg(rating)::STRING AS average, count(*)::STRING AS total
       FROM review
      WHERE product_id = $1 AND status = 'approved' AND deleted_at IS NULL`,
    [productId],
  );
  const count = Number(row?.total ?? 0);
  return {
    average: count === 0 || row?.average === null ? null : Number(row?.average),
    count,
  };
}

export type ModerationReview = PublishedReview & {
  productId: string;
  productName: string;
  authorEmail: string | null;
  status: string;
};

export async function listReviewsForModeration(
  filters: { status?: string; limit?: number } = {},
): Promise<ModerationReview[]> {
  const conditions = ["r.deleted_at IS NULL"];
  const values: unknown[] = [];
  if (filters.status) {
    values.push(filters.status);
    conditions.push(`r.status = $${values.length}`);
  }
  values.push(filters.limit ?? 100);

  const rows = await query<{
    id: string;
    product_id: string;
    product_name: string;
    author_name: string;
    author_email: string | null;
    rating: string;
    title: string | null;
    body: string;
    verified_purchase: boolean;
    status: string;
    submitted_at: Date;
  }>(
    `SELECT r.id, r.product_id, p.name AS product_name, r.author_name, r.author_email,
            r.rating::STRING AS rating, r.title, r.body, r.verified_purchase, r.status,
            r.submitted_at
       FROM review r
       JOIN product p ON p.id = r.product_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY r.submitted_at DESC
      LIMIT $${values.length}`,
    values,
  );

  return rows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    authorName: row.author_name,
    authorEmail: row.author_email,
    rating: Number(row.rating),
    title: row.title,
    body: row.body,
    verifiedPurchase: row.verified_purchase,
    status: row.status,
    submittedAt: row.submitted_at,
  }));
}

export async function countPendingReviews(): Promise<number> {
  const row = await queryOne<{ total: string }>(
    "SELECT count(*)::STRING AS total FROM review WHERE status = 'pending' AND deleted_at IS NULL",
  );
  return Number(row?.total ?? 0);
}

async function moderate(
  reviewId: string,
  status: "approved" | "rejected",
  actor: { staffId: string },
  reason?: string | null,
): Promise<void> {
  await withTransaction(async (tx) => {
    const before = await tx.query("SELECT status FROM review WHERE id = $1", [reviewId]);
    if (before.rows.length === 0) throw new ReviewNotFoundError();

    await tx.query(
      `UPDATE review
          SET status = $2, moderated_at = now(), moderated_by = $3, reject_reason = $4
        WHERE id = $1`,
      [reviewId, status, actor.staffId, reason ?? null],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: `review.${status}`,
      entityType: "review",
      entityId: reviewId,
      before: before.rows[0],
      after: { status, reason: reason ?? null },
    });
  });
}

export async function approveReview(reviewId: string, actor: { staffId: string }): Promise<void> {
  await moderate(reviewId, "approved", actor);
}

export async function rejectReview(
  reviewId: string,
  reason: string,
  actor: { staffId: string },
): Promise<void> {
  await moderate(reviewId, "rejected", actor, reason);
}

/** Nothing is hard-deleted, reviews included — §6. */
export async function softDeleteReview(
  reviewId: string,
  reason: string,
  actor: { staffId: string },
): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.query(
      "UPDATE review SET deleted_at = now(), deleted_by = $2, deleted_reason = $3 WHERE id = $1",
      [reviewId, actor.staffId, reason],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "review.deleted",
      entityType: "review",
      entityId: reviewId,
      after: { reason },
    });
  });
}

/**
 * Moderating a batch in one transaction.
 *
 * Because anyone may review (Q9), the pending queue is a real workload with real
 * spam in it, and clearing it one click at a time is the difference between a
 * moderation queue someone keeps up with and one they abandon.
 *
 * One transaction, so a batch either lands whole or not at all — a half-applied
 * batch would leave staff unsure what they had actually approved. Each review
 * still gets its own audit record, because "who approved this one" must stay
 * answerable per review, not per click.
 */
export async function moderateReviews(
  reviewIds: readonly string[],
  status: "approved" | "rejected",
  actor: { staffId: string },
  reason?: string | null,
): Promise<number> {
  if (reviewIds.length === 0) return 0;

  return withTransaction(async (tx) => {
    // Only rows still pending are touched, so a stale checkbox from a list
    // someone else has already worked through cannot silently re-decide one.
    const updated = await tx.query(
      `UPDATE review
          SET status = $2, moderated_at = now(), moderated_by = $3, reject_reason = $4
        WHERE id = ANY($1) AND status = 'pending' AND deleted_at IS NULL
      RETURNING id`,
      [reviewIds, status, actor.staffId, reason ?? null],
    );

    for (const row of updated.rows as { id: string }[]) {
      await recordAudit(tx, {
        actorType: "staff",
        actorId: actor.staffId,
        action: `review.${status}`,
        entityType: "review",
        entityId: row.id,
        before: { status: "pending" },
        after: { status, reason: reason ?? null, viaBulkAction: true },
      });
    }

    return updated.rows.length;
  });
}
