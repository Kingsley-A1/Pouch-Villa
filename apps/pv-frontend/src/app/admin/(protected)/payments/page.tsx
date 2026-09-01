import type { Metadata } from "next";
import Link from "next/link";
import { listProofQueue } from "@pv/backend/services/payments";
import { formatKobo } from "@pv/backend/domain/money";
import { describeStatus } from "@pv/backend/domain/order-status";
import { requirePermission } from "@/server/session";
import { ProofReview } from "./proof-review";

export const metadata: Metadata = { title: "Payments & proofs" };
export const dynamic = "force-dynamic";

type Params = { searchParams: Promise<{ status?: string }> };

const STATUSES = ["pending", "accepted", "rejected"] as const;

export default async function PaymentsAdminPage({ searchParams }: Params) {
  await requirePermission("payment.view");

  const { status } = await searchParams;
  const filter = STATUSES.find((candidate) => candidate === status) ?? "pending";

  const queue = await listProofQueue({ status: filter });

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
                ? "border-(--pv-red) bg-(--pv-red) text-white"
                : "border-(--pv-line) bg-white"
            }`}
          >
            {candidate}
          </Link>
        ))}
      </div>

      {queue.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-(--pv-line) bg-white p-6 text-sm text-(--pv-muted)">
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
            <li key={entry.proofId} className="rounded-2xl border border-(--pv-line) bg-white p-5">
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
                <ProofReview proofId={entry.proofId} status={entry.status} />
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
