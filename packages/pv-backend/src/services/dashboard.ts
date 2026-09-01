import type { PermissionCode } from "../auth/permission-codes";
import { query } from "../db/client";
import { kobo, type Kobo } from "../domain/money";
import type { OrderStatus } from "../domain/order-status";

/**
 * The admin dashboard's figures.
 *
 * Deliberately **two queries, not twelve**. A query against this CockroachDB
 * cluster costs 2–3s even warm, so a dashboard built from a dozen independent
 * counts would take half a minute to paint — on the screen staff open first,
 * every morning, on a phone. Everything that can share a scan does.
 *
 * Money is only counted once it is real: an order contributes to revenue from
 * `payment_confirmed` onwards, and never if it was cancelled. Counting
 * `awaiting_payment` as revenue would show the CEO a number that has not
 * arrived in the bank.
 */

/** Statuses where the money has actually been confirmed. */
const EARNING_STATUSES: readonly OrderStatus[] = [
  "payment_confirmed",
  "preparing",
  "ready_for_pickup",
  "dispatched",
  "completed",
];

export type DashboardTotals = {
  ordersToday: number;
  ordersThisWeek: number;
  revenueTodayKobo: Kobo;
  revenueThisWeekKobo: Kobo;
  /** Orders that have been paid for but not yet handed over. */
  openOrders: number;
  awaitingPayment: number;
};

export type AttentionItem = {
  key: string;
  label: string;
  count: number;
  href: string;
  /** True where the item is money- or customer-facing and should lead. */
  urgent: boolean;
};

export type LowStockVariant = {
  productId: string;
  productName: string;
  sku: string;
  inStock: number;
};

/**
 * Every headline figure in one round trip.
 *
 * `FILTER (WHERE …)` rather than several counts, so CockroachDB scans
 * `customer_order` once. The interval literals are constants in this file and
 * never come from a caller, so there is no path from a request into this string.
 */
export async function readDashboardTotals(): Promise<DashboardTotals> {
  const earning = EARNING_STATUSES.map((status) => `'${status}'`).join(", ");

  const rows = await query<{
    orders_today: string;
    orders_week: string;
    revenue_today: string;
    revenue_week: string;
    open_orders: string;
    awaiting_payment: string;
  }>(
    `SELECT
       count(*) FILTER (WHERE placed_at >= now() - INTERVAL '1 day')::STRING   AS orders_today,
       count(*) FILTER (WHERE placed_at >= now() - INTERVAL '7 days')::STRING  AS orders_week,
       coalesce(sum(total_kobo) FILTER (
         WHERE status IN (${earning}) AND placed_at >= now() - INTERVAL '1 day'
       ), 0)::STRING AS revenue_today,
       coalesce(sum(total_kobo) FILTER (
         WHERE status IN (${earning}) AND placed_at >= now() - INTERVAL '7 days'
       ), 0)::STRING AS revenue_week,
       count(*) FILTER (
         WHERE status IN ('payment_confirmed', 'preparing', 'ready_for_pickup', 'dispatched')
       )::STRING AS open_orders,
       count(*) FILTER (WHERE status = 'awaiting_payment')::STRING AS awaiting_payment
     FROM customer_order
     WHERE deleted_at IS NULL`,
  );

  const row = rows[0];
  return {
    ordersToday: Number(row?.orders_today ?? 0),
    ordersThisWeek: Number(row?.orders_week ?? 0),
    revenueTodayKobo: kobo(Number(row?.revenue_today ?? 0)),
    revenueThisWeekKobo: kobo(Number(row?.revenue_week ?? 0)),
    openOrders: Number(row?.open_orders ?? 0),
    awaitingPayment: Number(row?.awaiting_payment ?? 0),
  };
}

/**
 * The queue lengths, in one round trip across four tables.
 *
 * This is the part of the dashboard that actually drives a working day: what is
 * waiting for a person. Each is returned with the permission it needs so the
 * caller can hide what a role cannot act on — showing an Employee a count they
 * are not allowed to open is worse than showing nothing.
 */
export async function readAttentionQueues(): Promise<
  { item: AttentionItem; permission: PermissionCode }[]
> {
  const rows = await query<{
    proofs: string;
    reviews: string;
    enquiries: string;
    to_prepare: string;
  }>(
    `SELECT
       (SELECT count(*) FROM payment_proof WHERE status = 'pending')::STRING AS proofs,
       (SELECT count(*) FROM review
         WHERE status = 'pending' AND deleted_at IS NULL)::STRING AS reviews,
       (SELECT count(*) FROM contact_request
         WHERE status = 'new' AND deleted_at IS NULL)::STRING AS enquiries,
       (SELECT count(*) FROM customer_order
         WHERE status = 'payment_confirmed' AND deleted_at IS NULL)::STRING AS to_prepare`,
  );
  const row = rows[0];

  return [
    {
      permission: "payment.view",
      item: {
        key: "proofs",
        label: "Transfer receipts to check",
        count: Number(row?.proofs ?? 0),
        href: "/admin/payments?status=pending",
        urgent: true,
      },
    },
    {
      permission: "order.manage",
      item: {
        key: "to_prepare",
        label: "Paid orders to prepare",
        count: Number(row?.to_prepare ?? 0),
        href: "/admin/orders?status=payment_confirmed",
        urgent: true,
      },
    },
    {
      permission: "review.moderate",
      item: {
        key: "reviews",
        label: "Reviews awaiting approval",
        count: Number(row?.reviews ?? 0),
        href: "/admin/reviews?status=pending",
        urgent: false,
      },
    },
    {
      permission: "enquiry.manage",
      item: {
        key: "enquiries",
        label: "New enquiries",
        count: Number(row?.enquiries ?? 0),
        href: "/admin/contact?status=new",
        urgent: false,
      },
    },
  ];
}

/**
 * Variants running out, derived from the ledger rather than a stored counter.
 *
 * Only published products: an unpublished draft with no stock is not a problem
 * anyone needs to act on, and listing it would bury the ones that are.
 */
export async function readLowStock(threshold = 3, limit = 8): Promise<LowStockVariant[]> {
  const rows = await query<{
    product_id: string;
    product_name: string;
    sku: string;
    in_stock: string;
  }>(
    `SELECT p.id AS product_id, p.name AS product_name, v.sku,
            coalesce(sum(se.delta), 0)::STRING AS in_stock
       FROM product_variant v
       JOIN product p ON p.id = v.product_id
       LEFT JOIN stock_entry se ON se.variant_id = v.id
      WHERE v.deleted_at IS NULL AND v.is_active
        AND p.deleted_at IS NULL AND p.status = 'published'
      GROUP BY p.id, p.name, v.sku
     HAVING coalesce(sum(se.delta), 0) <= $1
      ORDER BY coalesce(sum(se.delta), 0), p.name
      LIMIT $2`,
    [threshold, limit],
  );

  return rows.map((row) => ({
    productId: row.product_id,
    productName: row.product_name,
    sku: row.sku,
    inStock: Number(row.in_stock),
  }));
}
