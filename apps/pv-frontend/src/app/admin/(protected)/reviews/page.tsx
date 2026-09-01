import type { Metadata } from "next";
import Link from "next/link";
import { listReviewsForModeration } from "@pv/backend/services/reviews";
import { requirePermission } from "@/server/session";
import { SavedViews } from "@/components/admin/saved-views";
import { BulkBar } from "@/components/admin/bulk-bar";
import { ReviewDecision } from "./review-decision";
import { bulkModerateAction } from "./actions";

export const metadata: Metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

type Params = { searchParams: Promise<{ status?: string; done?: string }> };

const STATUSES = ["pending", "approved", "rejected"] as const;

export default async function ReviewsAdminPage({ searchParams }: Params) {
  await requirePermission("review.moderate");

  const { status, done } = await searchParams;
  const filter = STATUSES.find((candidate) => candidate === status) ?? "pending";

  const reviews = await listReviewsForModeration({ status: filter });
  const anyPending = reviews.some((review) => review.status === "pending");

  const list = (
    <ul className="mt-6 grid gap-4 lg:grid-cols-2">
      {reviews.map((review) => (
        <li
          key={review.id}
          className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-5 has-[.bulk-select:checked]:border-(--pv-red)"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {review.status === "pending" ? (
                <label className="grid h-11 w-6 place-items-center">
                  <input
                    type="checkbox"
                    name="reviewIds"
                    value={review.id}
                    className="bulk-select h-4 w-4 accent-(--pv-red)"
                    aria-label={`Select the review of ${review.productName} by ${review.authorName}`}
                  />
                </label>
              ) : null}
              <div>
                <p className="font-bold">{review.productName}</p>
                <p className="text-sm text-(--pv-muted)">
                  {review.rating} out of 5 · {review.authorName}
                  {review.verifiedPurchase ? " · verified purchase" : ""}
                </p>
              </div>
            </div>
            <time className="text-xs text-(--pv-muted)" dateTime={review.submittedAt.toISOString()}>
              {formatLagos(review.submittedAt)}
            </time>
          </div>

          {review.title ? <p className="mt-3 font-semibold">{review.title}</p> : null}
          <p className="mt-1 text-sm leading-6">{review.body}</p>

          <ReviewDecision reviewId={review.id} status={review.status} />
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">Reviews</h1>
      <p className="mt-2 max-w-prose text-sm text-(--pv-muted)">
        Anyone can leave a review, and nothing appears on the storefront until it is published here.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUSES.map((candidate) => (
          <Link
            key={candidate}
            href={`/admin/reviews?status=${candidate}`}
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

      <SavedViews screen="reviews" currentQuery={`status=${filter}`} />

      {done ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-(--pv-line) bg-(--pv-wash) px-4 py-3 text-sm font-semibold"
        >
          {done}
        </p>
      ) : null}

      {reviews.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-(--pv-line) bg-(--pv-surface) p-6 text-sm text-(--pv-muted)">
          {filter === "pending" ? "Nothing is waiting to be checked." : `No ${filter} reviews.`}
        </p>
      ) : anyPending ? (
        /*
          The list lives inside the form, so the checkboxes are collected
          natively and the action bar needs no client state at all.
        */
        <form action={bulkModerateAction}>
          <input type="hidden" name="status" value={filter} />
          <BulkBar
            name="reviewIds"
            actions={
              <>
                <button
                  type="submit"
                  name="decision"
                  value="rejected"
                  className="inline-flex min-h-11 items-center rounded-xl bg-(--pv-danger) px-4 text-sm font-bold text-(--pv-on-brand)"
                >
                  Reject
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="approved"
                  className="inline-flex min-h-11 items-center rounded-xl bg-(--pv-red) px-4 text-sm font-bold text-(--pv-on-brand)"
                >
                  Publish
                </button>
              </>
            }
          >
            {list}
          </BulkBar>
        </form>
      ) : (
        list
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
