import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle, Circle } from "@phosphor-icons/react/dist/ssr";
import { getOrderByReference } from "@pv/backend/services/orders";
import { listProofsForOrder } from "@pv/backend/services/payments";
import { readSettings, pick } from "@pv/backend/services/settings";
import { formatKobo } from "@pv/backend/domain/money";
import { describeStatus } from "@pv/backend/domain/order-status";
import { normaliseOrderReference } from "@pv/backend/domain/reference";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AwaitingConfirmation } from "@/components/awaiting-confirmation";
import { getCustomerPrincipal } from "@/server/customer-session";
import { hasOrderAccess } from "@/server/order-access";
import { ProofUpload } from "./proof-upload";

export const metadata: Metadata = { title: "Your order" };
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ reference: string }> };

export default async function OrderPage({ params }: Params) {
  const { reference: raw } = await params;
  const reference = normaliseOrderReference(decodeURIComponent(raw));
  if (reference === null) notFound();

  const order = await getOrderByReference(reference);
  if (order === null) notFound();

  /**
   * Authority, re-derived server-side on every render — never inferred from the
   * URL. Either the signed-in customer owns this order, or they hold the
   * short-lived grant issued at placement. Anyone else is sent to /track to
   * prove the registered phone, per ADR 0002.
   */
  const customer = await getCustomerPrincipal();
  const owned = customer !== null && order.customerId === customer.customerId;
  const granted = await hasOrderAccess(reference);
  if (!owned && !granted) redirect(`/track?reference=${encodeURIComponent(reference)}`);

  const [proofs, settings] = await Promise.all([
    listProofsForOrder(order.id),
    readSettings(["bank.account_name", "bank.account_number", "bank.bank_name"]),
  ]);

  const accountName = pick(settings, "bank.account_name");
  const accountNumber = pick(settings, "bank.account_number");
  const bankName = pick(settings, "bank.bank_name");
  const bankKnown = accountName.present && accountNumber.present && bankName.present;

  const awaitingPayment = order.status === "awaiting_payment" || order.status === "proof_submitted";

  return (
    <>
      <Breadcrumbs trail={[{ label: `Order ${order.reference}` }]} />
      <section className="section-space">
        <div className="container-shell grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
          <div>
            <p className="eyebrow">Order {order.reference}</p>
            <h1 className="section-title mt-1">{describeStatus(order.status)}</h1>

            <ol className="mt-8 grid gap-3">
              {order.timeline.map((entry, index) => {
                const latest = index === order.timeline.length - 1;
                return (
                  <li key={`${entry.toStatus}-${index}`} className="flex items-start gap-3">
                    {latest ? (
                      <CheckCircle
                        size={22}
                        weight="fill"
                        className="mt-0.5 flex-none text-(--pv-success)"
                        aria-hidden="true"
                      />
                    ) : (
                      <Circle
                        size={22}
                        className="mt-0.5 flex-none text-(--pv-muted)"
                        aria-hidden="true"
                      />
                    )}
                    <div>
                      <p className="font-semibold">
                        {entry.note ?? describeStatus(entry.toStatus)}
                      </p>
                      <time className="help" dateTime={entry.occurredAt.toISOString()}>
                        {formatLagos(entry.occurredAt)}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ol>

            <h2 className="mt-10 text-lg font-bold">What you ordered</h2>
            <ul className="mt-3 grid gap-2">
              {order.lines.map((line) => (
                <li
                  key={line.id}
                  className="flex justify-between gap-4 border-b border-(--pv-line) pb-2 text-sm"
                >
                  <span>
                    {line.productName}
                    {Object.values(line.axes).length > 0
                      ? ` · ${Object.values(line.axes).join(" · ")}`
                      : ""}{" "}
                    × {line.quantity}
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
                <dt className="text-(--pv-muted)">
                  {order.fulfilment === "pickup" ? "Collection" : "Delivery"}
                </dt>
                <dd className="tabular-nums">{formatKobo(order.deliveryFeeKobo)}</dd>
              </div>
              <div className="flex justify-between border-t border-(--pv-line) pt-2 text-base">
                <dt className="font-bold">Total</dt>
                <dd className="font-extrabold tabular-nums">{formatKobo(order.totalKobo)}</dd>
              </div>
            </dl>
          </div>

          <aside className="grid gap-5 lg:sticky lg:top-24">
            {awaitingPayment ? (
              <div className="card-surface p-5">
                <h2 className="text-lg font-bold">Pay by transfer</h2>

                {/*
                  §0 rule 2 and §4: where the bank details are not configured we
                  say so, rather than rendering an empty box where an account
                  number should be. An invented placeholder that reaches a
                  customer is worse than an honest blank.
                */}
                {bankKnown ? (
                  <>
                    <dl className="mt-3 grid gap-2 text-sm">
                      <div>
                        <dt className="help">Account name</dt>
                        <dd className="font-semibold">{accountName.value}</dd>
                      </div>
                      <div>
                        <dt className="help">Account number</dt>
                        <dd className="font-mono text-lg font-bold tracking-wider tabular-nums">
                          {accountNumber.value}
                        </dd>
                      </div>
                      <div>
                        <dt className="help">Bank</dt>
                        <dd className="font-semibold">{bankName.value}</dd>
                      </div>
                    </dl>
                    <p className="mt-3 rounded-xl bg-(--pv-wash) p-3 text-sm">
                      Use <strong>{order.reference}</strong> as the transfer narration, then upload
                      your receipt below.
                    </p>
                  </>
                ) : (
                  <div className="mt-3">
                    <AwaitingConfirmation what="account for transfers" />
                  </div>
                )}
              </div>
            ) : null}

            {awaitingPayment ? (
              <ProofUpload
                orderId={order.id}
                reference={order.reference}
                existingProofs={proofs.map((proof) => ({
                  id: proof.id,
                  status: proof.status,
                  uploadedAt: formatLagos(proof.uploadedAt),
                  rejectReason: proof.rejectReason,
                }))}
              />
            ) : null}

            <div className="card-surface p-5">
              <h2 className="text-lg font-bold">Keep this reference</h2>
              <p className="help mt-2">
                You can check this order any time at{" "}
                <Link href="/track" className="font-semibold underline">
                  Track order
                </Link>{" "}
                using <strong>{order.reference}</strong> and the phone number on the order.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

/** §6: timestamps are stored UTC and rendered in Africa/Lagos. */
function formatLagos(value: Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(value);
}
