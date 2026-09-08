import type { Metadata } from "next";
import Link from "next/link";
import { listProofQueue } from "@pv/backend/services/payments";
import { listCounterQueue } from "@pv/backend/services/counter-payments";
import { formatKobo } from "@pv/backend/domain/money";
import { describeStatus } from "@pv/backend/domain/order-status";
import { describePaymentMethodForStaff } from "@pv/backend/domain/payment-method";
import { formatPhoneLocal } from "@pv/backend/domain/phone";
import { requirePermission } from "@/server/session";
import { SavedViews } from "@/components/admin/saved-views";
import { ProofReview } from "./proof-review";

export const metadata: Metadata = { title: "Payments & proofs" };
export const dynamic = "force-dynamic";

type Params = { searchParams: Promise<{ status?: string }> };

const STATUSES = ["pending", "accepted", "rejected"] as const;

export default async function PaymentsAdminPage({ searchParams }: Params) {
  await requirePermission("payment.view");

  const { status } = await searchParams;
  const filter = STATUSES.find((candidate) => candidate === status) ?? "pending";

  /*
    Two queues, one screen. A proof waiting to be checked and a customer coming in
    to pay are both "money we are waiting on", and a shop that has to remember to
    look in two places will eventually look in one.

    Only under the pending filter. The accepted and rejected tabs are a history of
    decisions about proofs, and a counter order that has not been paid for yet is
    not a decision anybody has made.
  */
  const [queue, counterQueue] = await Promise.all([
    listProofQueue({ status: filter }),
    filter === "pending" ? listCounterQueue() : Promise.resolve([]),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Payments &amp; proofs</h1>
      <p className="mt-2 max-w-prose text-sm text-(--pv-muted)">
        Transfer receipts buyers have uploaded. Opening one is recorded against your account.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUSES.map((candidate) => (
          <Link
            key={candidate}
            href={`/admin/payments?status=${candidate}`}
            aria-current={filter === candidate ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold capitalize ${
              filter === candidate
                ? "border-(--pv-red) bg-(--pv-red) text-(--pv-on-brand)"
                : "border-(--pv-line) bg-(--pv-surface)"
            }`}
          >
            {candidate}
          </Link>
        ))}
      </div>

      <SavedViews screen="payments" currentQuery={`status=${filter}`} />

      {counterQueue.length > 0 ? (
        <section className="mt-6" aria-labelledby="counter-queue">
          <h2 id="counter-queue" className="text-lg font-bold">
            Coming in to pay
          </h2>
          <p className="mt-1 text-sm text-(--pv-muted)">
            Collecting in store. Open one when the customer arrives and record what they paid with.
          </p>
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {counterQueue.map((entry) => (
              <li
                key={entry.orderId}
                className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/orders/${entry.orderId}`}
                      className="font-mono font-bold underline"
                    >
                      {entry.reference}
                    </Link>
                    <p className="mt-0.5 truncate text-sm text-(--pv-muted)">
                      {entry.contactName} · {formatPhoneLocal(entry.contactPhone)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold tabular-nums">{formatKobo(entry.amountKobo)}</p>
                    {/* Stated in words, not by colour alone (WCAG 2.2 AA). */}
                    <p className="text-xs font-semibold text-(--pv-muted)">
                      {describePaymentMethodForStaff(entry.preferredMethod)} expected
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-(--pv-muted)">
                  {entry.preferredPickupAt === null
                    ? "No time given"
                    : `Coming ${formatLagos(entry.preferredPickupAt)}`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {queue.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-(--pv-line) bg-(--pv-surface) p-6 text-sm text-(--pv-muted)">
          {filter === "pending"
            ? "No receipts are waiting to be checked."
            : `No ${filter} receipts.`}
        </p>
      ) : (
        /*
          Cards at every width rather than a table. Each row carries a document
          viewer and a decision with a reason, which a table cell cannot hold
          usably on a phone — and the phone is the primary target here (§2).
        */
        <ul className="mt-6 grid gap-4 lg:grid-cols-2">
          {queue.map((entry) => (
            <li
              key={entry.proofId}
              className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/admin/orders/${entry.orderId}`}
                    className="font-mono font-bold underline"
                  >
                    {entry.reference}
                  </Link>
                  <p className="mt-0.5 text-sm text-(--pv-muted)">{entry.contactName}</p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold tabular-nums">{formatKobo(entry.amountKobo)}</p>
                  <p className="text-xs text-(--pv-muted)">{describeStatus(entry.orderStatus)}</p>
                </div>
              </div>

              <p className="mt-2 text-xs text-(--pv-muted)">
                Uploaded {formatLagos(entry.uploadedAt)} · {entry.contentType}
              </p>

              <div className="mt-4">
                <ProofReview
                  proofId={entry.proofId}
                  status={entry.status}
                  contentType={entry.contentType}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
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
