import { createHash } from "node:crypto";
import { query, queryOne, type Queryable } from "../db/client";
import { withTransaction } from "../db/transaction";
import { addKobo, kobo, multiplyKobo, type Kobo } from "../domain/money";
import {
  assertTransition,
  type Fulfilment,
  type OrderStatus,
  type TransitionActor,
} from "../domain/order-status";
import { normalisePhone } from "../domain/phone";
import { generateOrderReference } from "../domain/reference";
import { recordAudit } from "./audit";
import { findOrCreateCustomerForOrder } from "./customer-account";

/**
 * Order placement and lifecycle.
 *
 * Three rules from AGENTS.md meet in this file, and each one is load-bearing:
 *
 *   §3  Placement is **idempotent**. Nigerian mobile data drops mid-request, the
 *       customer taps again, and exactly one order must exist.
 *   §6  Every buyer-visible fact is **snapshotted** into `order_line`. A receipt
 *       must not change because someone edited a price.
 *   §3  Stock is an **append-only ledger**. Placement writes a negative entry
 *       rather than mutating a counter, which is the only correct shape under
 *       CockroachDB's serializable isolation.
 */

export class CartEmptyError extends Error {
  constructor() {
    super("Your cart is empty.");
    this.name = "CartEmptyError";
  }
}

export class InsufficientStockError extends Error {
  constructor(
    readonly productName: string,
    readonly available: number,
  ) {
    super(
      available <= 0
        ? `${productName} has just gone out of stock.`
        : `Only ${available} of ${productName} ${available === 1 ? "is" : "are"} left.`,
    );
    this.name = "InsufficientStockError";
  }
}

export class DeliveryDetailsRequiredError extends Error {
  constructor() {
    super("Enter where the order should be delivered.");
    this.name = "DeliveryDetailsRequiredError";
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("That request was already used for a different order.");
    this.name = "IdempotencyConflictError";
  }
}

export class OrderNotFoundError extends Error {
  constructor() {
    super("We could not find that order.");
    this.name = "OrderNotFoundError";
  }
}

const IDEMPOTENCY_SCOPE = "order.place";

/** A stable digest of what was ordered, so a reused key with a different basket is caught. */
function hashRequest(input: PlaceOrderInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        cartId: input.cartId,
        email: input.contactEmail.trim().toLowerCase(),
        phone: input.contactPhone,
        fulfilment: input.fulfilment,
        zone: input.deliveryZoneId ?? null,
        address: input.deliveryAddress ?? null,
      }),
    )
    .digest("hex");
}

export type PlaceOrderInput = {
  cartId: string;
  idempotencyKey: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  fulfilment: Fulfilment;
  deliveryZoneId?: string | null;
  deliveryLga?: string | null;
  deliveryAddress?: string | null;
  deliveryLandmark?: string | null;
  customerNote?: string | null;
  /** ADR 0002's ticked-by-default checkbox. Unticking places a guest order. */
  createAccount: boolean;
  /** Present when the shopper was already signed in. */
  customerId?: string | null;
};

export type PlacedOrder = {
  orderId: string;
  reference: string;
  totalKobo: Kobo;
  /** True where this request replayed an order that already existed. */
  replayed: boolean;
};

type CartLineForOrder = {
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
 * Places an order.
 *
 * The whole thing is one retry-aware transaction, and the body is safe to run
 * twice: every write is inside it, and the only value generated in the body — the
 * order reference — has no effect outside the transaction, so a retry simply
 * produces a different one.
 *
 * Nothing with an external effect happens here. The confirmation email is sent by
 * the caller **after** this commits, per the warning on `withTransaction`.
 */
export async function placeOrder(
  input: PlaceOrderInput,
  context: { ip?: string | undefined; requestId?: string | undefined } = {},
): Promise<PlacedOrder> {
  const requestHash = hashRequest(input);
  const phone = normalisePhone(input.contactPhone);
  if (phone === null) throw new DeliveryDetailsRequiredError();

  if (input.fulfilment === "delivery" && !input.deliveryAddress?.trim()) {
    throw new DeliveryDetailsRequiredError();
  }

  return withTransaction(async (tx) => {
    // ---------------------------------------------------------------------
    // Idempotency first. The UNIQUE constraint on (scope, key) is what makes a
    // double-submitted order impossible; everything below only runs when this
    // insert wins.
    // ---------------------------------------------------------------------
    const claimed = await tx.query(
      `INSERT INTO idempotency_key (scope, key, request_hash)
            VALUES ($1, $2, $3)
       ON CONFLICT (scope, key) DO NOTHING
         RETURNING key`,
      [IDEMPOTENCY_SCOPE, input.idempotencyKey, requestHash],
    );

    if (claimed.rows.length === 0) {
      const priorRows = await tx.query(
        "SELECT request_hash, result_id FROM idempotency_key WHERE scope = $1 AND key = $2",
        [IDEMPOTENCY_SCOPE, input.idempotencyKey],
      );
      const prior = priorRows.rows[0] as
        { request_hash: string; result_id: string | null } | undefined;

      // The same key deliberately reused for a different basket is a client bug,
      // and must never quietly return someone else's order.
      if (prior === undefined || prior.request_hash !== requestHash) {
        throw new IdempotencyConflictError();
      }
      if (prior.result_id === null) throw new IdempotencyConflictError();

      const existing = await tx.query(
        "SELECT id, reference, total_kobo::STRING AS total_kobo FROM customer_order WHERE id = $1",
        [prior.result_id],
      );
      const order = existing.rows[0] as
        { id: string; reference: string; total_kobo: string } | undefined;
      if (order === undefined) throw new OrderNotFoundError();

      return {
        orderId: order.id,
        reference: order.reference,
        totalKobo: kobo(Number(order.total_kobo)),
        replayed: true,
      };
    }

    // ---------------------------------------------------------------------
    // The basket, priced at this instant. Reading the stock sum in the same
    // statement keeps it to one round trip and puts the read inside the
    // transaction, so a concurrent order that would oversell conflicts and one
    // of the two retries.
    // ---------------------------------------------------------------------
    const cartRows = await tx.query(
      `SELECT ci.variant_id,
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
      [input.cartId],
    );

    const lines = cartRows.rows as CartLineForOrder[];
    if (lines.length === 0) throw new CartEmptyError();

    for (const line of lines) {
      const available = Number(line.in_stock);
      if (available < Number(line.quantity)) {
        throw new InsufficientStockError(line.product_name, available);
      }
    }

    const subtotalKobo = addKobo(
      ...lines.map((line) => multiplyKobo(kobo(Number(line.price_kobo)), Number(line.quantity))),
    );

    // ---------------------------------------------------------------------
    // Delivery. The fee is snapshotted from the zone, so a later fee rise never
    // retro-prices an order. An unresolved zone is zero — never a guess.
    // ---------------------------------------------------------------------
    let deliveryFeeKobo = kobo(0);
    let zoneId: string | null = null;

    if (input.fulfilment === "delivery" && input.deliveryZoneId) {
      const zoneRows = await tx.query(
        "SELECT id, fee_kobo::STRING AS fee_kobo FROM delivery_zone WHERE id = $1 AND deleted_at IS NULL AND is_active",
        [input.deliveryZoneId],
      );
      const zone = zoneRows.rows[0] as { id: string; fee_kobo: string } | undefined;
      if (zone !== undefined) {
        zoneId = zone.id;
        deliveryFeeKobo = kobo(Number(zone.fee_kobo));
      }
    }

    const totalKobo = addKobo(subtotalKobo, deliveryFeeKobo);

    // ---------------------------------------------------------------------
    // The account, where the checkbox was ticked or the shopper was signed in.
    // ---------------------------------------------------------------------
    let customerId = input.customerId ?? null;
    if (customerId === null && input.createAccount) {
      customerId = await findOrCreateCustomerForOrder(tx, {
        email: input.contactEmail,
        fullName: input.contactName,
        phone,
      });
    }

    // ---------------------------------------------------------------------
    // The order. The reference is retried against its UNIQUE index rather than
    // trusted blindly — at ~49.5 bits a collision is negligible, but "negligible"
    // is not "impossible", and the failure mode would be a customer's checkout.
    // ---------------------------------------------------------------------
    let orderId: string | null = null;
    let reference = "";
    for (let attempt = 0; attempt < 5 && orderId === null; attempt += 1) {
      reference = generateOrderReference();
      const inserted = await tx.query(
        `INSERT INTO customer_order
           (reference, customer_id, contact_name, contact_email, contact_phone, fulfilment,
            delivery_zone_id, delivery_lga, delivery_address, delivery_landmark,
            subtotal_kobo, delivery_fee_kobo, total_kobo, customer_note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (reference) DO NOTHING
         RETURNING id`,
        [
          reference,
          customerId,
          input.contactName.trim(),
          input.contactEmail.trim().toLowerCase(),
          phone,
          input.fulfilment,
          zoneId,
          input.fulfilment === "delivery" ? (input.deliveryLga ?? null) : null,
          input.fulfilment === "delivery" ? (input.deliveryAddress ?? null) : null,
          input.fulfilment === "delivery" ? (input.deliveryLandmark ?? null) : null,
          subtotalKobo,
          deliveryFeeKobo,
          totalKobo,
          input.customerNote ?? null,
        ],
      );
      orderId = (inserted.rows[0] as { id: string } | undefined)?.id ?? null;
    }
    if (orderId === null) throw new OrderNotFoundError();

    // ---------------------------------------------------------------------
    // Snapshots. Everything a receipt shows is frozen here.
    // ---------------------------------------------------------------------
    for (const [index, line] of lines.entries()) {
      const unitPriceKobo = kobo(Number(line.price_kobo));
      const quantity = Number(line.quantity);
      await tx.query(
        `INSERT INTO order_line
           (order_id, product_id, variant_id, product_name, product_slug, variant_sku,
            variant_axes, brand_name, image_url, unit_price_kobo, quantity, line_total_kobo,
            sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          orderId,
          line.product_id,
          line.variant_id,
          line.product_name,
          line.product_slug,
          line.variant_sku,
          JSON.stringify(line.axes ?? {}),
          line.brand_name,
          line.r2_key,
          unitPriceKobo,
          quantity,
          multiplyKobo(unitPriceKobo, quantity),
          index,
        ],
      );

      // Stock leaves as a ledger entry, never as a decremented counter.
      await tx.query(
        `INSERT INTO stock_entry (variant_id, delta, reason, note, order_id)
              VALUES ($1, $2, 'sold', $3, $4)`,
        [line.variant_id, -quantity, `Order ${reference}`, orderId],
      );
    }

    // The payment we are expecting, so the admin's Payments screen has a row to
    // reconcile against rather than inferring one from the order.
    await tx.query(
      `INSERT INTO payment (order_id, amount_kobo, status) VALUES ($1, $2, 'expected')`,
      [orderId, totalKobo],
    );

    await tx.query(
      `INSERT INTO order_event (order_id, from_status, to_status, actor_type, note)
            VALUES ($1, NULL, 'awaiting_payment', $2, 'Order placed')`,
      [orderId, customerId === null ? "system" : "customer"],
    );

    // The cart has become an order and must never be checked out again.
    await tx.query("DELETE FROM cart_item WHERE cart_id = $1", [input.cartId]);
    await tx.query("UPDATE cart SET converted_at = now() WHERE id = $1", [input.cartId]);

    await tx.query("UPDATE idempotency_key SET result_id = $3 WHERE scope = $1 AND key = $2", [
      IDEMPOTENCY_SCOPE,
      input.idempotencyKey,
      orderId,
    ]);

    await recordAudit(tx, {
      actorType: customerId === null ? "system" : "customer",
      actorId: customerId,
      action: "order.placed",
      entityType: "customer_order",
      entityId: orderId,
      after: {
        reference,
        fulfilment: input.fulfilment,
        subtotalKobo,
        deliveryFeeKobo,
        totalKobo,
        lineCount: lines.length,
      },
      requestId: context.requestId,
      ip: context.ip,
    });

    return { orderId, reference, totalKobo, replayed: false };
  });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Advances an order, refusing anything the state machine does not allow.
 *
 * Authority is checked by the caller, which knows the actor; this refuses on the
 * machine's own terms. Both records are written: `order_event` for the customer's
 * timeline and `audit_event` for §5's privileged-mutation trail.
 *
 * A cancellation returns stock to the ledger, because the goods were never sold.
 */
export async function transitionOrder(
  orderId: string,
  to: OrderStatus,
  actor: { type: TransitionActor; id?: string | null },
  options: { note?: string | null; reason?: string | null } = {},
): Promise<OrderStatus> {
  return withTransaction(async (tx) => {
    const rows = await tx.query(
      `SELECT id, reference, status, fulfilment
         FROM customer_order WHERE id = $1 AND deleted_at IS NULL`,
      [orderId],
    );
    const order = rows.rows[0] as
      { id: string; reference: string; status: OrderStatus; fulfilment: Fulfilment } | undefined;
    if (order === undefined) throw new OrderNotFoundError();

    const transition = assertTransition(order.status, to, {
      fulfilment: order.fulfilment,
      actor: actor.type,
    });

    const timestamps =
      to === "completed"
        ? ", completed_at = now()"
        : to === "cancelled"
          ? ", cancelled_at = now(), cancel_reason = $3"
          : "";

    const parameters: unknown[] = [orderId, to];
    if (to === "cancelled") parameters.push(options.reason ?? null);

    await tx.query(
      `UPDATE customer_order SET status = $2, updated_at = now()${timestamps} WHERE id = $1`,
      parameters,
    );

    if (to === "cancelled") {
      // The goods were never sold, so the ledger gets them back. Derived from
      // the order lines rather than a stored counter, so it is exact.
      await tx.query(
        `INSERT INTO stock_entry (variant_id, delta, reason, note, order_id)
              SELECT ol.variant_id, ol.quantity, 'returned', $2, ol.order_id
                FROM order_line ol
               WHERE ol.order_id = $1 AND ol.variant_id IS NOT NULL`,
        [orderId, `Cancelled order ${order.reference}`],
      );
      await tx.query(
        "UPDATE payment SET status = 'rejected', updated_at = now() WHERE order_id = $1 AND status IN ('expected', 'under_review')",
        [orderId],
      );
    }

    await tx.query(
      `INSERT INTO order_event (order_id, from_status, to_status, actor_type, actor_id, note)
            VALUES ($1, $2, $3, $4, $5, $6)`,
      [orderId, order.status, to, actor.type, actor.id ?? null, options.note ?? transition.label],
    );

    await recordAudit(tx, {
      actorType: actor.type,
      actorId: actor.id ?? null,
      action: `order.${to}`,
      entityType: "customer_order",
      entityId: orderId,
      before: { status: order.status },
      after: { status: to, reason: options.reason ?? null },
    });

    return to;
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type OrderLine = {
  id: string;
  productName: string;
  productSlug: string;
  variantSku: string;
  axes: Record<string, string>;
  brandName: string | null;
  unitPriceKobo: Kobo;
  quantity: number;
  lineTotalKobo: Kobo;
};

export type OrderTimelineEntry = {
  toStatus: OrderStatus;
  note: string | null;
  occurredAt: Date;
};

export type Order = {
  id: string;
  reference: string;
  status: OrderStatus;
  fulfilment: Fulfilment;
  customerId: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  deliveryLga: string | null;
  deliveryAddress: string | null;
  deliveryLandmark: string | null;
  subtotalKobo: Kobo;
  deliveryFeeKobo: Kobo;
  totalKobo: Kobo;
  customerNote: string | null;
  placedAt: Date;
  lines: OrderLine[];
  timeline: OrderTimelineEntry[];
};

type OrderRow = {
  id: string;
  reference: string;
  status: OrderStatus;
  fulfilment: Fulfilment;
  customer_id: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  delivery_lga: string | null;
  delivery_address: string | null;
  delivery_landmark: string | null;
  subtotal_kobo: string;
  delivery_fee_kobo: string;
  total_kobo: string;
  customer_note: string | null;
  placed_at: Date;
};

async function hydrate(tx: Queryable | null, row: OrderRow): Promise<Order> {
  const runner = tx
    ? async <T extends Record<string, unknown>>(sql: string, values: unknown[]) =>
        (await tx.query(sql, values)).rows as T[]
    : async <T extends Record<string, unknown>>(sql: string, values: unknown[]) =>
        (await query(sql, values)) as unknown as T[];

  const lineRows = await runner<{
    id: string;
    product_name: string;
    product_slug: string;
    variant_sku: string;
    variant_axes: Record<string, string> | null;
    brand_name: string | null;
    unit_price_kobo: string;
    quantity: string;
    line_total_kobo: string;
  }>(
    `SELECT id, product_name, product_slug, variant_sku, variant_axes, brand_name,
            unit_price_kobo::STRING AS unit_price_kobo,
            quantity::STRING AS quantity,
            line_total_kobo::STRING AS line_total_kobo
       FROM order_line WHERE order_id = $1 ORDER BY sort_order`,
    [row.id],
  );

  const eventRows = await runner<{
    to_status: OrderStatus;
    note: string | null;
    occurred_at: Date;
  }>(
    "SELECT to_status, note, occurred_at FROM order_event WHERE order_id = $1 ORDER BY occurred_at",
    [row.id],
  );

  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    fulfilment: row.fulfilment,
    customerId: row.customer_id,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    deliveryLga: row.delivery_lga,
    deliveryAddress: row.delivery_address,
    deliveryLandmark: row.delivery_landmark,
    subtotalKobo: kobo(Number(row.subtotal_kobo)),
    deliveryFeeKobo: kobo(Number(row.delivery_fee_kobo)),
    totalKobo: kobo(Number(row.total_kobo)),
    customerNote: row.customer_note,
    placedAt: row.placed_at,
    lines: lineRows.map((line) => ({
      id: line.id,
      productName: line.product_name,
      productSlug: line.product_slug,
      variantSku: line.variant_sku,
      axes: line.variant_axes ?? {},
      brandName: line.brand_name,
      unitPriceKobo: kobo(Number(line.unit_price_kobo)),
      quantity: Number(line.quantity),
      lineTotalKobo: kobo(Number(line.line_total_kobo)),
    })),
    timeline: eventRows.map((event) => ({
      toStatus: event.to_status,
      note: event.note,
      occurredAt: event.occurred_at,
    })),
  };
}

/**
 * CockroachDB's INT is 64-bit, and node-postgres returns int8 as a string rather
 * than risk a silent precision loss past 2^53. Every integer column is therefore
 * cast in SQL and converted explicitly — the same convention the catalogue reads
 * use. Passing one straight to `kobo()` throws, which is the branded type doing
 * exactly its job.
 */
const ORDER_COLUMNS = `id, reference, status, fulfilment, customer_id, contact_name, contact_email,
                       contact_phone, delivery_lga, delivery_address, delivery_landmark,
                       subtotal_kobo::STRING AS subtotal_kobo,
                       delivery_fee_kobo::STRING AS delivery_fee_kobo,
                       total_kobo::STRING AS total_kobo,
                       customer_note, placed_at`;

export async function getOrderById(orderId: string): Promise<Order | null> {
  const row = await queryOne<OrderRow>(
    `SELECT ${ORDER_COLUMNS} FROM customer_order WHERE id = $1 AND deleted_at IS NULL`,
    [orderId],
  );
  return row === null ? null : hydrate(null, row);
}

/**
 * Order tracking, authorised by reference **plus** the registered phone.
 *
 * ADR 0002 makes customer email a contact channel rather than an identity proof,
 * so the reference alone is not enough — otherwise anyone who saw a reference on
 * a transfer narration could read a stranger's address and phone number.
 */
export async function findOrderForTracking(
  reference: string,
  phone: string,
): Promise<Order | null> {
  const normalisedPhone = normalisePhone(phone);
  if (normalisedPhone === null) return null;

  const row = await queryOne<OrderRow>(
    `SELECT ${ORDER_COLUMNS} FROM customer_order
      WHERE reference = $1 AND contact_phone = $2 AND deleted_at IS NULL`,
    [reference, normalisedPhone],
  );
  return row === null ? null : hydrate(null, row);
}

/**
 * Looks an order up by reference **without** checking the phone.
 *
 * Every caller must have established authority some other way — a session that
 * owns the order, a signed short-lived grant, or a staff permission. Tracking by
 * a reference typed into a public form must use `findOrderForTracking`, which
 * requires the phone as well, per ADR 0002.
 */
export async function getOrderByReference(reference: string): Promise<Order | null> {
  const row = await queryOne<OrderRow>(
    `SELECT ${ORDER_COLUMNS} FROM customer_order WHERE reference = $1 AND deleted_at IS NULL`,
    [reference],
  );
  return row === null ? null : hydrate(null, row);
}

export async function listOrdersForCustomer(customerId: string, limit = 50): Promise<Order[]> {
  const rows = await query<OrderRow>(
    `SELECT ${ORDER_COLUMNS} FROM customer_order
      WHERE customer_id = $1 AND deleted_at IS NULL
      ORDER BY placed_at DESC LIMIT $2`,
    [customerId, limit],
  );
  return Promise.all(rows.map((row) => hydrate(null, row)));
}

export type AdminOrderSummary = {
  id: string;
  reference: string;
  status: OrderStatus;
  fulfilment: Fulfilment;
  contactName: string;
  contactPhone: string;
  totalKobo: Kobo;
  placedAt: Date;
  lineCount: number;
  hasPendingProof: boolean;
};

export async function listOrders(
  filters: { status?: OrderStatus; limit?: number } = {},
): Promise<AdminOrderSummary[]> {
  const conditions = ["o.deleted_at IS NULL"];
  const values: unknown[] = [];
  if (filters.status) {
    values.push(filters.status);
    conditions.push(`o.status = $${values.length}`);
  }
  values.push(filters.limit ?? 100);

  const rows = await query<{
    id: string;
    reference: string;
    status: OrderStatus;
    fulfilment: Fulfilment;
    contact_name: string;
    contact_phone: string;
    total_kobo: string;
    placed_at: Date;
    line_count: string;
    pending_proofs: string;
  }>(
    `SELECT o.id, o.reference, o.status, o.fulfilment, o.contact_name, o.contact_phone,
            o.total_kobo::STRING AS total_kobo, o.placed_at,
            (SELECT count(*) FROM order_line ol WHERE ol.order_id = o.id)::STRING AS line_count,
            (SELECT count(*) FROM payment_proof pp
              WHERE pp.order_id = o.id AND pp.status = 'pending')::STRING AS pending_proofs
       FROM customer_order o
      WHERE ${conditions.join(" AND ")}
      ORDER BY o.placed_at DESC
      LIMIT $${values.length}`,
    values,
  );

  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    status: row.status,
    fulfilment: row.fulfilment,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    totalKobo: kobo(Number(row.total_kobo)),
    placedAt: row.placed_at,
    lineCount: Number(row.line_count),
    hasPendingProof: Number(row.pending_proofs) > 0,
  }));
}

export async function countOrdersByStatus(): Promise<Record<string, number>> {
  const rows = await query<{ status: string; total: string }>(
    "SELECT status, count(*)::STRING AS total FROM customer_order WHERE deleted_at IS NULL GROUP BY status",
  );
  return Object.fromEntries(rows.map((row) => [row.status, Number(row.total)]));
}

export type BulkTransitionResult = {
  moved: number;
  /** References the machine refused, with why — shown rather than swallowed. */
  refused: { reference: string; reason: string }[];
};

/**
 * Advancing several orders at once — "these six are packed", on a phone, once.
 *
 * Deliberately **not** one transaction. A batch is a convenience, not an atomic
 * business fact: if four of six can legally move and two cannot, the right
 * outcome is four moved and two explained, not six refused because of an order
 * someone else had already cancelled. Each order keeps its own transaction, its
 * own timeline entry and its own audit record.
 *
 * Every move still goes through `transitionOrder`, so the state machine and the
 * fulfilment branch are enforced exactly as they are for a single order. There
 * is no bulk path that bypasses them.
 */
export async function transitionOrders(
  orderIds: readonly string[],
  to: OrderStatus,
  actor: { type: TransitionActor; id?: string | null },
  options: { reason?: string | null } = {},
): Promise<BulkTransitionResult> {
  const refused: { reference: string; reason: string }[] = [];
  let moved = 0;

  for (const orderId of orderIds) {
    try {
      await transitionOrder(orderId, to, actor, options);
      moved += 1;
    } catch (error) {
      const order = await getOrderById(orderId).catch(() => null);
      refused.push({
        reference: order?.reference ?? orderId,
        reason:
          error instanceof Error && error.name === "IllegalTransitionError"
            ? error.message
            : "could not be updated",
      });
    }
  }

  return { moved, refused };
}
