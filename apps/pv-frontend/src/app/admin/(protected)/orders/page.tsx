import type { Metadata } from "next";
import Link from "next/link";
import { countOrdersByStatus, listOrders } from "@pv/backend/services/orders";
import { ORDER_STATUSES, describeStatus, isOrderStatus } from "@pv/backend/domain/order-status";
import { formatKobo } from "@pv/backend/domain/money";
import { formatPhoneLocal } from "@pv/backend/domain/phone";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

type Params = { searchParams: Promise<{ status?: string }> };

export default async function OrdersAdminPage({ searchParams }: Params) {
  await requirePermission("order.view");

  const { status } = await searchParams;
  const filter = status !== undefined && isOrderStatus(status) ? status : undefined;

  const [orders, counts] = await Promise.all([
    listOrders(filter === undefined ? {} : { status: filter }),
    countOrdersByStatus(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Orders</h1>

      {/* Filters scroll horizontally inside their own container rather than
          making the page scroll sideways (§2). */}
      <div className="-mx-1 mt-4 overflow-x-auto px-1">
        <div className="flex w-max gap-2 pb-1">
          <FilterChip href="/admin/orders" active={filter === undefined} label="All" />
          {ORDER_STATUSES.map((candidate) => (
            <FilterChip
              key={candidate}
              href={`/admin/orders?status=${candidate}`}
              active={filter === candidate}
              label={`${describeStatus(candidate)} (${counts[candidate] ?? 0})`}
            />
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-(--pv-line) bg-white p-6 text-sm text-(--pv-muted)">
          {filter === undefined
            ? "No orders have been placed yet."
            : `No orders are ${describeStatus(filter).toLowerCase()}.`}
        </p>
      ) : (
        <>
          {/*
            Card layout below md and a table from md up. The client asked to run
            the business from a phone, so the small-screen view is the primary
            one here, not a fallback (§2).
          */}
          <ul className="mt-6 grid gap-3 md:hidden">
            {orders.map((order) => (
              <li key={order.id} className="rounded-2xl border border-(--pv-line) bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-mono font-bold underline"
                  >
                    {order.reference}
                  </Link>
                  <span className="status-pill bg-(--pv-wash)">{describeStatus(order.status)}</span>
                </div>
                <p className="mt-2 font-semibold">{order.contactName}</p>
                <p className="text-sm text-(--pv-muted)">
                  {formatPhoneLocal(order.contactPhone)} · {order.fulfilment}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-(--pv-muted)">
                    {order.lineCount} {order.lineCount === 1 ? "item" : "items"}
                    {order.hasPendingProof ? " · proof waiting" : ""}
                  </span>
                  <span className="font-bold tabular-nums">{formatKobo(order.totalKobo)}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="table-wrap mt-6 hidden md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Buyer</th>
                  <th scope="col">Items</th>
                  <th scope="col">Total</th>
                  <th scope="col">Status</th>
                  <th scope="col">Placed</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono font-bold underline"
                      >
                        {order.reference}
                      </Link>
                    </td>
                    <td>
                      {order.contactName}
                      <span className="block text-xs text-(--pv-muted)">
                        {formatPhoneLocal(order.contactPhone)}
                      </span>
                    </td>
                    <td className="tabular-nums">{order.lineCount}</td>
                    <td className="tabular-nums">{formatKobo(order.totalKobo)}</td>
                    <td>
                      {describeStatus(order.status)}
                      {order.hasPendingProof ? (
                        <span className="block text-xs text-(--pv-warning)">Proof waiting</span>
                      ) : null}
                    </td>
                    <td className="text-xs text-(--pv-muted)">{formatLagos(order.placedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${
        active ? "border-(--pv-red) bg-(--pv-red) text-white" : "border-(--pv-line) bg-white"
      }`}
    >
      {label}
    </Link>
  );
}

/** §6: stored UTC, rendered Africa/Lagos. */
function formatLagos(value: Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(value);
}
