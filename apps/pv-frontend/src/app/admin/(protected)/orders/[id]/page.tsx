import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@pv/backend/services/orders";
import { listProofsForOrder } from "@pv/backend/services/payments";
import { availableTransitions, describeStatus } from "@pv/backend/domain/order-status";
import { describePaymentMethod } from "@pv/backend/domain/payment-method";
import { formatLagos } from "@pv/backend/domain/lagos-time";
import { readSettlement } from "@pv/backend/services/counter-payments";
import { formatKobo } from "@pv/backend/domain/money";
import { formatPhoneLocal } from "@pv/backend/domain/phone";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { requirePermission } from "@/server/session";
import { StatusControl } from "./status-control";
import { CounterPayment } from "./counter-payment";

export const metadata: Metadata = { title: "Order" };
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function OrderDetailPage({ params }: Params) {
  await requirePermission("order.view");

  const { id } = await params;
  const order = await getOrderById(id);
  if (order === null) notFound();

  const [proofs, settlement] = await Promise.all([
    listProofsForOrder(order.id),
    readSettlement(order.id),
  ]);

  /*
    The counter control appears only where money is genuinely outstanding on an
    order somebody is coming in to pay for. Offering it on a delivery order would
    invite a staff member to mark cash taken for goods that have not left the
    shop, and offering it on a settled order is how a payment gets recorded twice.
  */
  const takingPaymentAtCounter =
    order.paymentTiming === "on_collection" &&
    (order.status === "awaiting_payment" || order.status === "proof_submitted");

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
        <span className="status-pill bg-(--pv-wash)">
          {describeStatus(order.status, order.paymentTiming)}
        </span>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="grid gap-5">
          <section className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-5">
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

          <section className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-5">
            <h2 className="text-lg font-bold">History</h2>
            <ol className="mt-3 grid gap-2 text-sm">
              {order.timeline.map((entry, index) => (
                <li key={`${entry.toStatus}-${index}`} className="flex justify-between gap-4">
                  <span>{entry.note ?? describeStatus(entry.toStatus, order.paymentTiming)}</span>
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
          {/*
            First in the column, above "Next step", because for these orders it is
            the step. A customer is standing at the counter while this screen is
            open, and making the staff member scroll past four cards to find the
            button is the whole difference between a good counter and a queue.
          */}
          {takingPaymentAtCounter ? (
            <section className="rounded-2xl border-2 border-(--pv-red) bg-(--pv-surface) p-5">
              <h2 className="text-lg font-bold">Take payment</h2>
              <p className="mt-1 text-sm text-(--pv-muted)">
                Collecting and paying in store. They said{" "}
                <span className="font-semibold text-(--pv-ink)">
                  {describePaymentMethod(order.preferredPaymentMethod).toLowerCase()}
                </span>
                {order.preferredPickupAt === null
                  ? "."
                  : `, coming ${formatLagos(order.preferredPickupAt)}.`}
              </p>
              <div className="mt-4">
                <CounterPayment
                  orderId={order.id}
                  amountLabel={formatKobo(order.totalKobo)}
                  preferred={order.preferredPaymentMethod}
                />
              </div>
            </section>
          ) : null}

          {/*
            What the money actually arrived as, once it has. The preference above
            is what they said; this is what the till took, and a reconciliation
            needs the second one.
          */}
          {settlement !== null ? (
            <section className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-5">
              <h2 className="text-lg font-bold">Paid</h2>
              <dl className="mt-3 grid gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="help">Method</dt>
                  <dd className="font-semibold">{describePaymentMethod(settlement.method)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="help">Amount</dt>
                  <dd className="font-extrabold tabular-nums">{formatKobo(order.totalKobo)}</dd>
                </div>
                {settlement.note !== null ? (
                  <div className="flex justify-between gap-3">
                    <dt className="help">Reference</dt>
                    <dd className="font-semibold break-all">{settlement.note}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          <section className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-5">
            <h2 className="text-lg font-bold">Next step</h2>
            <div className="mt-3">
              <StatusControl orderId={order.id} steps={steps} />
            </div>
          </section>

          <section className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-5">
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

          {/*
            The two documents this order produces, both readable here.

            The client asked to see "the payment invoice and the order invoice"
            in one place, and this is the screen a staff member is already on
            when a customer rings up about either. They are the same bytes the
            customer downloads, from the same route — so what staff read on the
            phone is exactly what the customer is holding, which is the entire
            point of the call.
          */}
          <section className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-5">
            <h2 className="text-lg font-bold">Documents</h2>
            <ul className="mt-3 grid gap-2">
              <li>
                <a
                  href={`/api/v1/orders/${order.id}/receipt?kind=invoice`}
                  className="button-ghost w-full"
                >
                  <DownloadSimple size={18} weight="bold" aria-hidden="true" />
                  Order invoice (PDF)
                </a>
              </li>
              <li>
                <a
                  href={`/api/v1/orders/${order.id}/receipt?kind=receipt`}
                  className="button-ghost w-full"
                >
                  <DownloadSimple size={18} weight="bold" aria-hidden="true" />
                  Payment receipt (PDF)
                </a>
              </li>
            </ul>
            <p className="mt-3 text-xs text-(--pv-muted)">
              The payment receipt states where the payment has actually got to, so it is safe to
              send before a transfer has been confirmed.
            </p>
          </section>

          <section className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-5">
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
