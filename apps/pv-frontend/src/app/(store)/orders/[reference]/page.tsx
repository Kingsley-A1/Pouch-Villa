import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle, Circle, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { getOrderByReference } from "@pv/backend/services/orders";
import { listProofsForOrder } from "@pv/backend/services/payments";
import { readSettings, pick } from "@pv/backend/services/settings";
import { formatKobo } from "@pv/backend/domain/money";
import { describeStatus } from "@pv/backend/domain/order-status";
import { normaliseOrderReference } from "@pv/backend/domain/reference";
import { staffHasPermission } from "@pv/backend/services/roles";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AwaitingConfirmation } from "@/components/awaiting-confirmation";
import { getCustomerPrincipal } from "@/server/customer-session";
import { getStaffPrincipal } from "@/server/session";
import { hasOrderAccess } from "@/server/order-access";
import { ProofUpload } from "./proof-upload";
import { TransferDetails } from "./transfer-details";

export const metadata: Metadata = { title: "Your order" };
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrderPage({ params, searchParams }: Params) {
  const { reference: raw } = await params;
  const newAccount = (await searchParams).account === "new";
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
  if (!owned && !granted) {
    /*
      A staff member who lands here goes to the admin, not to /track.

      This is the path a scanned receipt takes. The QR opens this page because
      that is the one URL that means "this order" to everybody — but a staff
      member holding a customer's receipt has no customer session and no
      placement grant, so without this they would be asked to prove a phone
      number that is not theirs, on a page that would then show them less than
      the admin already does.

      It grants nothing. `order.view` is re-derived from the database here
      exactly as it is on the screen being redirected to, and a staff member
      without it falls through to /track like anyone else.
    */
    const staff = await getStaffPrincipal();
    if (staff !== null && (await staffHasPermission(staff.staffId, "order.view"))) {
      redirect(`/admin/orders/${order.id}`);
    }
    redirect(`/track?reference=${encodeURIComponent(reference)}`);
  }

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

            {/*
              Said here rather than by redirecting to the account itself. The
              next thing this person has to do is make a transfer, and the
              details for it are on this page — a profile screen in between
              would be a worse welcome than none.

              Rendered on the query the checkout redirect set, and only for
              somebody who is actually signed in, so a shared or bookmarked link
              cannot congratulate a stranger on an account they do not have.
            */}
            {newAccount && customer !== null ? (
              <p className="mt-4 rounded-2xl border border-(--pv-line) bg-(--pv-cream) p-4 text-sm">
                <span className="font-bold">Your Pouch Villa account is ready.</span> You are signed
                in as {customer.email}. Everything you order is kept in{" "}
                <Link href="/account" className="font-bold text-(--pv-red) underline">
                  your account
                </Link>
                .
              </p>
            ) : null}

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
            {/*
              §0 rule 2 and §4: where the bank details are not configured we say
              so, rather than rendering an empty box where an account number
              should be. An invented placeholder that reaches a customer is
              worse than an honest blank.
            */}
            {awaitingPayment ? (
              bankKnown ? (
                <TransferDetails
                  accountName={accountName.value}
                  accountNumber={accountNumber.value}
                  bankName={bankName.value}
                  amountLabel={formatKobo(order.totalKobo)}
                  reference={order.reference}
                />
              ) : (
                <div className="card-surface p-5">
                  <h2 className="text-lg font-bold">Pay by transfer</h2>
                  <div className="mt-3">
                    <AwaitingConfirmation what="account for transfers" />
                  </div>
                </div>
              )
            ) : null}

            {awaitingPayment ? (
              <ProofUpload
                orderId={order.id}
                reference={order.reference}
                signedIn={customer !== null}
                existingProofs={proofs.map((proof) => ({
                  id: proof.id,
                  status: proof.status,
                  uploadedAt: formatLagos(proof.uploadedAt),
                  rejectReason: proof.rejectReason,
                }))}
              />
            ) : null}

            {/*
              The order's paperwork, on the page the order lives on.

              The invoice exists from the moment the order does. The payment
              receipt only appears once something has actually been sent to be
              receipted — offering a receipt against a transfer nobody has made
              would be offering a document that says nothing true.
            */}
            <div className="card-surface p-5">
              <h2 className="text-lg font-bold">Documents</h2>
              <ul className="mt-3 grid gap-2">
                <li>
                  <a
                    href={`/api/v1/orders/${order.id}/receipt?kind=invoice`}
                    className="button-ghost w-full"
                  >
                    <DownloadSimple size={18} weight="bold" aria-hidden="true" />
                    Invoice (PDF)
                  </a>
                </li>
                {proofs.length > 0 ? (
                  <li>
                    <a
                      href={`/api/v1/orders/${order.id}/receipt?kind=receipt`}
                      className="button-ghost w-full"
                    >
                      <DownloadSimple size={18} weight="bold" aria-hidden="true" />
                      Payment receipt (PDF)
                    </a>
                  </li>
                ) : null}
              </ul>
              <p className="help mt-3">Each one carries a QR code that opens this order.</p>
            </div>

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
