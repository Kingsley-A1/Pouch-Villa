import { query, queryOne } from "../db/client";
import { withTransaction } from "../db/transaction";
import { kobo, type Kobo } from "../domain/money";
import type { OrderStatus } from "../domain/order-status";
import type { PaymentMethod, PaymentTiming } from "../domain/payment-method";
import { recordAudit } from "./audit";
import { syncPaymentSearchDocumentsForOrder } from "./admin-search-index";
import { transitionOrder } from "./orders";

/**
 * Taking money over the counter.
 *
 * The shop sells online and in person, and a customer who collects can pay with
 * cash, with the POS terminal, or by making the transfer while standing there.
 * This is the one function that records any of it.
 *
 * **Why it is not just a status change.** `transitionOrder(id, "payment_confirmed")`
 * moves the order and writes the timeline, but it leaves the `payment` row saying
 * `expected` — so the order claims to be paid and the financial record disagrees.
 * That was already true of the admin's direct-confirm button before counter
 * payment existed; routing both through here fixes it and gives the shop the one
 * thing a till reconciliation actually needs, which is what the money arrived as.
 *
 * The order reference is the whole interface at the counter. A customer reads it
 * off their phone or hands over a receipt whose QR opens the order; staff find it
 * and press one button. Everything else here exists to make that button safe.
 */

export class OrderNotFoundError extends Error {
  constructor() {
    super("That order was not found.");
    this.name = "OrderNotFoundError";
  }
}

export class PaymentAlreadySettledError extends Error {
  constructor(readonly reference: string) {
    super(`Order ${reference} has already been paid for.`);
    this.name = "PaymentAlreadySettledError";
  }
}

export class OrderNotPayableError extends Error {
  constructor(
    readonly reference: string,
    readonly status: OrderStatus,
  ) {
    super(`Order ${reference} cannot take a payment while it is ${status}.`);
    this.name = "OrderNotPayableError";
  }
}

export type RecordedPayment = {
  orderId: string;
  reference: string;
  method: PaymentMethod;
  amountKobo: Kobo;
  contactEmail: string;
  contactName: string;
};

/**
 * Records money taken for an order and confirms it, in one transaction.
 *
 * Idempotent by refusal rather than by silence: a second attempt on an order that
 * is already settled throws, because two staff members both pressing the button
 * is a question about whether the shop was paid twice, not something to swallow.
 */
export async function recordCounterPayment(
  input: { orderId: string; method: PaymentMethod; note?: string | null },
  actor: { staffId: string },
  context: { requestId?: string | undefined; ip?: string | undefined } = {},
): Promise<RecordedPayment> {
  const order = await queryOne<{
    id: string;
    reference: string;
    status: OrderStatus;
    total_kobo: string;
    contact_email: string;
    contact_name: string;
  }>(
    `SELECT id, reference, status, total_kobo::STRING AS total_kobo, contact_email, contact_name
       FROM customer_order
      WHERE id = $1 AND deleted_at IS NULL`,
    [input.orderId],
  );
  if (order === null) throw new OrderNotFoundError();

  // The two states where money is still outstanding. Anything else is either
  // already paid or cancelled, and both deserve a refusal a cashier can read.
  if (order.status !== "awaiting_payment" && order.status !== "proof_submitted") {
    throw new OrderNotPayableError(order.reference, order.status);
  }

  const amountKobo = kobo(Number(order.total_kobo));

  await withTransaction(async (tx) => {
    /*
      Settle exactly the row that is still outstanding, and let the update count
      decide. Reading the status and then writing it would be two round trips with
      a gap between them; a conditional UPDATE closes the gap, which matters here
      because the retry-aware transaction may run this body twice.
    */
    const settled = await tx.query(
      `UPDATE payment
          SET status = 'confirmed',
              settled_method = $2,
              received_by = $3,
              confirmed_at = now(),
              confirmed_by = $3,
              reference_note = coalesce($4, reference_note),
              updated_at = now()
        WHERE order_id = $1 AND status IN ('expected', 'under_review')
        RETURNING id`,
      [input.orderId, input.method, actor.staffId, input.note ?? null],
    );
    if (settled.rows.length === 0) throw new PaymentAlreadySettledError(order.reference);

    /*
      A proof sitting in the queue for an order that has just been paid in cash is
      not rejected — it was never wrong, it is simply no longer the thing being
      waited on. Leaving it pending would keep the order in the staff queue after
      the money is in the till.
    */
    await tx.query(
      `UPDATE payment_proof
          SET status = 'accepted', reviewed_at = now(), reviewed_by = $2
        WHERE order_id = $1 AND status = 'pending'`,
      [input.orderId, actor.staffId],
    );

    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "payment.recorded_at_counter",
      entityType: "customer_order",
      entityId: input.orderId,
      before: { status: order.status },
      // The note is a POS stub number or a transfer narration, never a card or
      // account number — §5 forbids either reaching a log or an audit row.
      after: { method: input.method, amountKobo, note: input.note ?? null },
      requestId: context.requestId,
      ip: context.ip,
    });
    await syncPaymentSearchDocumentsForOrder(tx, input.orderId);
  });

  // Outside the transaction: it opens its own, and nesting one retry-aware
  // transaction inside another is how a retry becomes a deadlock.
  await transitionOrder(input.orderId, "payment_confirmed", {
    type: "staff",
    id: actor.staffId,
  });

  return {
    orderId: order.id,
    reference: order.reference,
    method: input.method,
    amountKobo,
    contactEmail: order.contact_email,
    contactName: order.contact_name,
  };
}

/**
 * Who is coming in to pay, and when.
 *
 * The counter's own queue. Deliberately not folded into the proof queue's query:
 * these orders have no proof row to join to, and an outer join returning half-null
 * rows for two different kinds of work is how a screen ends up lying about both.
 * They are merged in the admin's view model, where the shape is a decision about
 * presentation rather than about SQL.
 */
export type CounterQueueEntry = {
  orderId: string;
  reference: string;
  contactName: string;
  contactPhone: string;
  amountKobo: Kobo;
  preferredMethod: PaymentMethod;
  preferredPickupAt: Date | null;
  placedAt: Date;
  status: OrderStatus;
};

export async function listCounterQueue(limit = 100): Promise<CounterQueueEntry[]> {
  const rows = await query<{
    id: string;
    reference: string;
    contact_name: string;
    contact_phone: string;
    total_kobo: string;
    preferred_payment_method: PaymentMethod;
    preferred_pickup_at: Date | null;
    placed_at: Date;
    status: OrderStatus;
  }>(
    `SELECT id, reference, contact_name, contact_phone,
            total_kobo::STRING AS total_kobo,
            preferred_payment_method, preferred_pickup_at, placed_at, status
       FROM customer_order
      WHERE payment_timing = 'on_collection'
        AND status IN ('awaiting_payment', 'proof_submitted')
        AND deleted_at IS NULL
      /*
        The next arrival leads. A slot nobody gave sorts last rather than first —
        NULLS LAST — because an order with a time on it is an appointment the shop
        can plan around and one without it is not.
      */
      ORDER BY preferred_pickup_at ASC NULLS LAST, placed_at ASC
      LIMIT $1`,
    [limit],
  );

  return rows.map((row) => ({
    orderId: row.id,
    reference: row.reference,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    amountKobo: kobo(Number(row.total_kobo)),
    preferredMethod: row.preferred_payment_method,
    preferredPickupAt: row.preferred_pickup_at,
    placedAt: row.placed_at,
    status: row.status,
  }));
}

/** How an order's money actually arrived, once it has. */
export async function readSettlement(
  orderId: string,
): Promise<{ method: PaymentMethod; timing: PaymentTiming; note: string | null } | null> {
  const row = await queryOne<{
    settled_method: PaymentMethod | null;
    payment_timing: PaymentTiming;
    reference_note: string | null;
  }>(
    `SELECT p.settled_method, o.payment_timing, p.reference_note
       FROM payment p
       JOIN customer_order o ON o.id = p.order_id
      WHERE p.order_id = $1 AND p.status = 'confirmed'
      ORDER BY p.updated_at DESC
      LIMIT 1`,
    [orderId],
  );
  if (row === null || row.settled_method === null) return null;
  return { method: row.settled_method, timing: row.payment_timing, note: row.reference_note };
}
