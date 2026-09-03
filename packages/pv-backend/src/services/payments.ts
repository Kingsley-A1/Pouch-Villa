import { createHash, randomUUID } from "node:crypto";
import { query, queryOne } from "../db/client";
import { withTransaction } from "../db/transaction";
import { kobo, type Kobo } from "../domain/money";
import type { OrderStatus } from "../domain/order-status";
import {
  MAX_PROOF_BYTES,
  PROOF_MIME_TYPES,
  proofKey,
  validateProof,
  type ProofFormat,
} from "../storage/documents";
import { deleteObject, getObjectBytes, presignRead, presignUpload, putObject } from "../storage/r2";
import { recordAudit } from "./audit";
import { syncPaymentSearchDocumentsForOrder } from "./admin-search-index";
import { assertWithinRateLimit, recordRateLimitHits } from "./rate-limit";
import { transitionOrder } from "./orders";

/**
 * Payments and transfer proofs.
 *
 * A payment proof is a **financial document containing bank details**, and
 * AGENTS.md §5 and §8 are unambiguous about the consequences: private bucket,
 * short-lived signed URLs, every access audited, never public, never served from
 * an app path. Three things follow that are easy to get wrong:
 *
 *   - No URL is ever stored. Only the R2 key. A stored URL is a URL that ends up
 *     in a log, an error message or a support ticket.
 *   - A proof URL is never logged and never put in an error message, per §5's
 *     closing rule.
 *   - Reading one is itself an audited event, not just writing one.
 *
 * Upload is two-step, exactly as product media is: the browser PUTs straight to
 * R2 so the bytes never cross the app server, and the object stays untrusted
 * until `finaliseProofUpload` has fetched it back and checked its magic bytes.
 */

export class ProofUploadNotFoundError extends Error {
  constructor() {
    super("That upload was not found or has already been handled.");
    this.name = "ProofUploadNotFoundError";
  }
}

export class OrderNotAwaitingPaymentError extends Error {
  constructor() {
    super("This order is not waiting for a payment proof.");
    this.name = "OrderNotAwaitingPaymentError";
  }
}

export class ProofNotFoundError extends Error {
  constructor() {
    super("That payment proof was not found.");
    this.name = "ProofNotFoundError";
  }
}

export class InvalidProofUploadSizeError extends Error {
  constructor() {
    super("That proof is empty or larger than the upload limit.");
    this.name = "InvalidProofUploadSizeError";
  }
}

export type BeganProofUpload = {
  uploadId: string;
  url: string;
  expiresIn: number;
  maxBytes: number;
};

/**
 * Issues a pre-signed PUT into the **private** bucket.
 *
 * Rate limited per IP and per order: an upload endpoint that anyone holding an
 * order reference can hit is a storage-fill vector, and §5 names payment-proof
 * upload specifically.
 */
export async function beginProofUpload(
  orderId: string,
  contentType: string,
  contentLength: number,
  context: { ip?: string | undefined } = {},
): Promise<BeganProofUpload> {
  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength <= 0 ||
    contentLength > MAX_PROOF_BYTES
  ) {
    throw new InvalidProofUploadSizeError();
  }
  await assertWithinRateLimit("payment_proof.upload", [context.ip, orderId]);

  const order = await queryOne<{ id: string; status: OrderStatus }>(
    "SELECT id, status FROM customer_order WHERE id = $1 AND deleted_at IS NULL",
    [orderId],
  );
  if (order === null) throw new ProofNotFoundError();
  if (order.status !== "awaiting_payment" && order.status !== "proof_submitted") {
    throw new OrderNotAwaitingPaymentError();
  }

  const stagingKey = `staging/proofs/${orderId}/${randomUUID()}`;
  const { url, expiresIn } = await presignUpload("private", stagingKey, contentType, contentLength);

  const rows = await query<{ id: string }>(
    "INSERT INTO payment_proof_upload (order_id, staging_key) VALUES ($1, $2) RETURNING id",
    [orderId, stagingKey],
  );

  await recordRateLimitHits("payment_proof.upload", [context.ip, orderId]);

  return {
    uploadId: rows[0]!.id,
    url,
    expiresIn,
    maxBytes: MAX_PROOF_BYTES,
  };
}

export type FinalisedProof = { proofId: string; format: ProofFormat };

/**
 * Fetches the staged object back, checks what it actually is, stores it under a
 * content-hashed key and advances the order.
 *
 * The R2 writes happen **before** the transaction opens, because a transaction
 * body may be re-executed on a CockroachDB retry and object writes are an
 * external effect. Re-running them would be wasteful at best; the content-hashed
 * key makes them idempotent, but they still do not belong inside.
 */
export async function finaliseProofUpload(
  uploadId: string,
  context: { ip?: string | undefined; requestId?: string | undefined } = {},
): Promise<FinalisedProof> {
  const staged = await queryOne<{ id: string; order_id: string; staging_key: string }>(
    "SELECT id, order_id, staging_key FROM payment_proof_upload WHERE id = $1 AND status = 'pending'",
    [uploadId],
  );
  if (staged === null) throw new ProofUploadNotFoundError();

  let bytes: Buffer;
  let validated;
  try {
    bytes = await getObjectBytes("private", staged.staging_key);
    validated = validateProof(bytes);
  } catch (error) {
    // A rejected upload leaves nothing behind. The reason is recorded so the
    // same bad file is not retried blindly — but the key never is.
    await deleteObject("private", staged.staging_key).catch(() => {});
    await query(
      "UPDATE payment_proof_upload SET status = 'rejected', reject_reason = $2 WHERE id = $1",
      [uploadId, error instanceof Error ? error.message : "Unreadable file"],
    );
    throw error;
  }

  const hash = createHash("sha256").update(bytes).digest("hex");
  const key = proofKey(staged.order_id, hash, validated.format);

  await putObject(
    "private",
    key,
    bytes,
    validated.contentType,
    // Never cached by an intermediary. This is not public media.
    "private, no-store",
  );
  await deleteObject("private", staged.staging_key).catch(() => {});

  const proofId = await withTransaction(async (tx) => {
    const inserted = await tx.query(
      `INSERT INTO payment_proof (order_id, payment_id, r2_key, content_type, byte_size, content_hash)
            VALUES ($1,
                    (SELECT id FROM payment WHERE order_id = $1 ORDER BY created_at LIMIT 1),
                    $2, $3, $4, $5)
       ON CONFLICT (r2_key) DO UPDATE SET uploaded_at = now()
         RETURNING id`,
      [staged.order_id, key, validated.contentType, validated.byteSize, hash],
    );
    const id = (inserted.rows[0] as { id: string }).id;

    await tx.query(
      "UPDATE payment_proof_upload SET status = 'finalised', finalised_at = now() WHERE id = $1",
      [uploadId],
    );
    await tx.query(
      "UPDATE payment SET status = 'under_review', updated_at = now() WHERE order_id = $1 AND status = 'expected'",
      [staged.order_id],
    );

    await recordAudit(tx, {
      actorType: "customer",
      action: "payment_proof.uploaded",
      entityType: "payment_proof",
      entityId: id,
      // Deliberately not the key: §5 forbids a payment-proof URL in anything
      // that might be read back or exported.
      after: {
        orderId: staged.order_id,
        contentType: validated.contentType,
        byteSize: validated.byteSize,
      },
      requestId: context.requestId,
      ip: context.ip,
    });
    await syncPaymentSearchDocumentsForOrder(tx, staged.order_id);

    return id;
  });

  // The order moves only once the proof is real. A customer performs this
  // transition, and the state machine is what decides whether it is allowed.
  const current = await queryOne<{ status: OrderStatus }>(
    "SELECT status FROM customer_order WHERE id = $1",
    [staged.order_id],
  );
  if (current?.status === "awaiting_payment") {
    await transitionOrder(staged.order_id, "proof_submitted", { type: "customer" });
  }

  return { proofId, format: validated.format };
}

/**
 * Issues a short-lived signed URL for a staff member to view a proof, and
 * **audits the access**. §8 requires every read of a payment proof to be logged;
 * this is the only function that can produce a readable URL.
 *
 * The returned URL is the caller's to render and must never be logged, stored or
 * put into an error message.
 */
export async function getProofViewUrl(
  proofId: string,
  actor: { staffId: string },
): Promise<{ url: string; contentType: string }> {
  const proof = await queryOne<{ r2_key: string; content_type: string; order_id: string }>(
    "SELECT r2_key, content_type, order_id FROM payment_proof WHERE id = $1",
    [proofId],
  );
  if (proof === null) throw new ProofNotFoundError();

  const url = await presignRead("private", proof.r2_key);

  await withTransaction(async (tx) => {
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "payment_proof.accessed",
      entityType: "payment_proof",
      entityId: proofId,
      after: { orderId: proof.order_id },
    });
  });

  return { url, contentType: proof.content_type };
}

/**
 * Accepts a transfer. This is the step the client described in Q6 — _"admin sees
 * it in their payment confirmation page, accepts it and user gets Email
 * notification that payment is received"_.
 *
 * The email is **not** sent here. It is an external effect and this runs inside
 * a transaction that may be retried, so the caller sends it after this resolves.
 */
export async function acceptProof(
  proofId: string,
  actor: { staffId: string },
  note?: string | null,
): Promise<{ orderId: string; reference: string; contactEmail: string; contactName: string }> {
  const proof = await queryOne<{ order_id: string }>(
    "SELECT order_id FROM payment_proof WHERE id = $1",
    [proofId],
  );
  if (proof === null) throw new ProofNotFoundError();

  await withTransaction(async (tx) => {
    await tx.query(
      `UPDATE payment_proof
          SET status = 'accepted', reviewed_at = now(), reviewed_by = $2
        WHERE id = $1`,
      [proofId, actor.staffId],
    );
    await tx.query(
      `UPDATE payment
          SET status = 'confirmed', confirmed_at = now(), confirmed_by = $2,
              reference_note = coalesce($3, reference_note), updated_at = now()
        WHERE order_id = $1`,
      [proof.order_id, actor.staffId, note ?? null],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "payment.confirmed",
      entityType: "payment_proof",
      entityId: proofId,
      after: { orderId: proof.order_id },
    });
    await syncPaymentSearchDocumentsForOrder(tx, proof.order_id);
  });

  await transitionOrder(proof.order_id, "payment_confirmed", {
    type: "staff",
    id: actor.staffId,
  });

  const order = await queryOne<{
    reference: string;
    contact_email: string;
    contact_name: string;
  }>("SELECT reference, contact_email, contact_name FROM customer_order WHERE id = $1", [
    proof.order_id,
  ]);

  return {
    orderId: proof.order_id,
    reference: order?.reference ?? "",
    contactEmail: order?.contact_email ?? "",
    contactName: order?.contact_name ?? "",
  };
}

/**
 * Rejects a proof and returns the order to `awaiting_payment`, so the customer
 * can upload a better photo rather than starting again.
 */
export async function rejectProof(
  proofId: string,
  reason: string,
  actor: { staffId: string },
): Promise<{ orderId: string }> {
  const proof = await queryOne<{ order_id: string }>(
    "SELECT order_id FROM payment_proof WHERE id = $1",
    [proofId],
  );
  if (proof === null) throw new ProofNotFoundError();

  await withTransaction(async (tx) => {
    await tx.query(
      `UPDATE payment_proof
          SET status = 'rejected', reviewed_at = now(), reviewed_by = $2, reject_reason = $3
        WHERE id = $1`,
      [proofId, actor.staffId, reason],
    );
    await tx.query(
      `UPDATE payment SET status = 'expected', updated_at = now()
        WHERE order_id = $1 AND status = 'under_review'`,
      [proof.order_id],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "payment.proof_rejected",
      entityType: "payment_proof",
      entityId: proofId,
      after: { orderId: proof.order_id, reason },
    });
    await syncPaymentSearchDocumentsForOrder(tx, proof.order_id);
  });

  const current = await queryOne<{ status: OrderStatus }>(
    "SELECT status FROM customer_order WHERE id = $1",
    [proof.order_id],
  );
  if (current?.status === "proof_submitted") {
    await transitionOrder(
      proof.order_id,
      "awaiting_payment",
      { type: "staff", id: actor.staffId },
      { note: "Payment proof could not be accepted" },
    );
  }

  return { orderId: proof.order_id };
}

// ---------------------------------------------------------------------------
// Reads for the admin's Payments & Proofs screen
// ---------------------------------------------------------------------------

export type PaymentQueueEntry = {
  proofId: string;
  orderId: string;
  reference: string;
  contactName: string;
  amountKobo: Kobo;
  contentType: string;
  uploadedAt: Date;
  status: string;
  orderStatus: OrderStatus;
};

export async function listProofQueue(
  filters: { status?: string; limit?: number } = {},
): Promise<PaymentQueueEntry[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (filters.status) {
    values.push(filters.status);
    conditions.push(`pp.status = $${values.length}`);
  }
  values.push(filters.limit ?? 100);

  const rows = await query<{
    proof_id: string;
    order_id: string;
    reference: string;
    contact_name: string;
    amount_kobo: string;
    content_type: string;
    uploaded_at: Date;
    status: string;
    order_status: OrderStatus;
  }>(
    `SELECT pp.id AS proof_id, pp.order_id, o.reference, o.contact_name,
            o.total_kobo::STRING AS amount_kobo, pp.content_type, pp.uploaded_at,
            pp.status, o.status AS order_status
       FROM payment_proof pp
       JOIN customer_order o ON o.id = pp.order_id
      ${conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""}
      ORDER BY pp.uploaded_at DESC
      LIMIT $${values.length}`,
    values,
  );

  return rows.map((row) => ({
    proofId: row.proof_id,
    orderId: row.order_id,
    reference: row.reference,
    contactName: row.contact_name,
    amountKobo: kobo(Number(row.amount_kobo)),
    contentType: row.content_type,
    uploadedAt: row.uploaded_at,
    status: row.status,
    orderStatus: row.order_status,
  }));
}

export async function listProofsForOrder(orderId: string) {
  const rows = await query<{
    id: string;
    content_type: string;
    byte_size: string;
    status: string;
    uploaded_at: Date;
    reject_reason: string | null;
  }>(
    `SELECT id, content_type, byte_size::STRING AS byte_size, status, uploaded_at, reject_reason
       FROM payment_proof WHERE order_id = $1 ORDER BY uploaded_at DESC`,
    [orderId],
  );
  return rows.map((row) => ({
    id: row.id,
    contentType: row.content_type,
    byteSize: Number(row.byte_size),
    status: row.status,
    uploadedAt: row.uploaded_at,
    rejectReason: row.reject_reason,
  }));
}

/** Staged proofs that were never finalised — an abandoned tab or a failed PUT. */
export async function sweepAbandonedProofUploads(olderThanHours = 24): Promise<number> {
  const rows = await query<{ id: string; staging_key: string }>(
    `SELECT id, staging_key FROM payment_proof_upload
      WHERE status = 'pending' AND created_at < now() - ($1 || ' hours')::INTERVAL
      LIMIT 500`,
    [String(olderThanHours)],
  );
  for (const row of rows) {
    await deleteObject("private", row.staging_key).catch(() => {});
    await query(
      "UPDATE payment_proof_upload SET status = 'rejected', reject_reason = 'abandoned' WHERE id = $1",
      [row.id],
    );
  }
  return rows.length;
}

export { PROOF_MIME_TYPES };
