import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@pv/backend/services/orders";
import { listProofsForOrder } from "@pv/backend/services/payments";
import { availableTransitions, describeStatus } from "@pv/backend/domain/order-status";
import { formatKobo } from "@pv/backend/domain/money";
import { formatPhoneLocal } from "@pv/backend/domain/phone";
import { requirePermission } from "@/server/session";
import { StatusControl } from "./status-control";

export const metadata: Metadata = { title: "Order" };
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function OrderDetailPage({ params }: Params) {
  await requirePermission("order.view");

  const { id } = await params;
  const order = await getOrderById(id);
  if (order === null) notFound();

  const proofs = await listProofsForOrder(order.id);

  const steps = availableTransitions(order.status, order.fulfilment).map((transition) => ({
    status: transition.to,
    label: transition.label,
    destructive: transition.to === "cancelled",
  }));

  return (
    <div>
      <Link href="/admin/orders" className="text-sm font-semibold underline">
        ← All orders
      </Link>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-mono text-2xl font-bold">{order.reference}</h1>
        <span className="status-pill bg-(--pv-wash)">{describeStatus(order.status)}</span>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="grid gap-5">
          <section className="rounded-2xl border border-(--pv-line) bg-white p-5">
            <h2 className="text-lg font-bold">Items</h2>
            <ul className="mt-3 grid gap-2">
              {order.lines.map((line) => (
                <li
                  key={line.id}
                  className="flex justify-between gap-4 border-b border-(--pv-line) pb-2 text-sm last:border-0"
                >
                  <span>
                    {line.productName}
                    {Object.values(line.axes).length > 0
                      ? ` · ${Object.values(line.axes).join(" · ")}`
                      : ""}
                    <span className="block text-xs text-(--pv-muted)">
                      {line.variantSku} × {line.quantity}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatKobo(line.lineTotalKobo)}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 grid gap-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-(--pv-muted)">Subtotal</dt>
                <dd className="tabular-nums">{formatKobo(order.subtotalKobo)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-(--pv-muted)">Delivery</dt>
                <dd className="tabular-nums">{formatKobo(order.deliveryFeeKobo)}</dd>
              </div>
              <div className="flex justify-between border-t border-(--pv-line) pt-2">
                <dt className="font-bold">Total</dt>
                <dd className="font-extrabold tabular-nums">{formatKobo(order.totalKobo)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-(--pv-line) bg-white p-5">
            <h2 className="text-lg font-bold">History</h2>
            <ol className="mt-3 grid gap-2 text-sm">
              {order.timeline.map((entry, index) => (
                <li key={`${entry.toStatus}-${index}`} className="flex justify-between gap-4">
                  <span>{entry.note ?? describeStatus(entry.toStatus)}</span>
                  <time
                    className="flex-none text-xs text-(--pv-muted)"
                    dateTime={entry.occurredAt.toISOString()}
                  >
                    {formatLagos(entry.occurredAt)}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="grid gap-5">
          <section className="rounded-2xl border border-(--pv-line) bg-white p-5">
            <h2 className="text-lg font-bold">Next step</h2>
            <div className="mt-3">
              <StatusControl orderId={order.id} steps={steps} />
            </div>
          </section>

          <section className="rounded-2xl border border-(--pv-line) bg-white p-5">
            <h2 className="text-lg font-bold">Buyer</h2>
            <dl className="mt-3 grid gap-2 text-sm">
              <div>
                <dt className="help">Name</dt>
                <dd className="font-semibold">{order.contactName}</dd>
              </div>
              <div>
                <dt className="help">Phone</dt>
                <dd className="font-semibold">{formatPhoneLocal(order.contactPhone)}</dd>
              </div>
              <div>
                <dt className="help">Email</dt>
                <dd className="font-semibold break-words">{order.contactEmail}</dd>
              </div>
              <div>
                <dt className="help">Fulfilment</dt>
                <dd className="font-semibold capitalize">{order.fulfilment}</dd>
              </div>
              {order.fulfilment === "delivery" ? (
                <div>
                  <dt className="help">Deliver to</dt>
                  <dd className="font-semibold">
                    {order.deliveryAddress}
                    {order.deliveryLandmark ? (
                      <span className="block font-normal text-(--pv-muted)">
                        Near {order.deliveryLandmark}
                      </span>
                    ) : null}
                    {order.deliveryLga ? (
                      <span className="block font-normal text-(--pv-muted)">
                        {order.deliveryLga}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
              {order.customerNote ? (
                <div>
                  <dt className="help">Note from buyer</dt>
                  <dd>{order.customerNote}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-2xl border border-(--pv-line) bg-white p-5">
            <h2 className="text-lg font-bold">Payment proofs</h2>
            {proofs.length === 0 ? (
              <p className="mt-2 text-sm text-(--pv-muted)">Nothing uploaded yet.</p>
            ) : (
              <ul className="mt-3 grid gap-2 text-sm">
                {proofs.map((proof) => (
                  <li key={proof.id} className="flex items-center justify-between gap-3">
                    <span>
                      <span className="font-semibold capitalize">{proof.status}</span>
                      <span className="block text-xs text-(--pv-muted)">
                        {formatLagos(proof.uploadedAt)}
                      </span>
                    </span>
                    {/* Viewing is on the Payments screen, where the access is
                        audited and the signed URL is issued (§8). */}
                    <Link href="/admin/payments" className="text-sm font-bold underline">
                      Review
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function formatLagos(value: Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(value);
}
