import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listOrdersForCustomer } from "@pv/backend/services/orders";
import { formatKobo } from "@pv/backend/domain/money";
import { describeStatus, isTerminal } from "@pv/backend/domain/order-status";
import { getCustomerPrincipal } from "@/server/customer-session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your orders" };

const DATE = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeZone: "Africa/Lagos",
});

/**
 * Purchase history.
 *
 * Every figure here is the one snapshotted at placement, read straight from the
 * order — never recomputed from live product data. A receipt that changed
 * because someone edited a price would be a different kind of document (§6).
 */
export default async function AccountOrdersPage() {
  const principal = await getCustomerPrincipal();
  if (principal === null) notFound();

  const orders = await listOrdersForCustomer(principal.customerId);

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-(--pv-line) p-8 text-center">
        <p className="text-(--pv-muted)">You have not placed an order yet.</p>
        <Link href="/shop" className="button-primary mt-5 inline-flex">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-4">
      {orders.map((order) => (
        <li key={order.id} className="card-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-bold">{order.reference}</p>
              <p className="text-sm text-(--pv-muted)">{DATE.format(order.placedAt)}</p>
            </div>
            <span
              className={`status-pill ${
                isTerminal(order.status) ? "bg-(--pv-wash)" : "bg-(--pv-cream) text-(--pv-red)"
              }`}
            >
              {describeStatus(order.status)}
            </span>
          </div>

          {/*
            The line items, snapshotted. `productSlug` still links to the live
            product where one exists, but the name and price shown are the
            order's own — the link is a convenience, not the source of truth.
          */}
          <ul className="mt-4 grid gap-1.5 text-sm">
            {order.lines.map((line) => (
              <li key={line.id} className="flex justify-between gap-4">
                <span className="min-w-0">
                  {line.quantity} ×{" "}
                  <Link href={`/products/${line.productSlug}`} className="hover:underline">
                    {line.productName}
                  </Link>
                  {Object.keys(line.axes).length > 0 ? (
                    <span className="text-(--pv-muted)">
                      {" "}
                      ({Object.values(line.axes).join(" · ")})
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums">{formatKobo(line.lineTotalKobo)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-(--pv-line) pt-4">
            <span className="font-extrabold text-(--pv-red)">{formatKobo(order.totalKobo)}</span>
            <Link
              href={`/orders/${order.reference}`}
              className="min-h-11 text-sm font-bold text-(--pv-red) hover:underline"
            >
              Track this order
              <span className="sr-only"> {order.reference}</span>
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
