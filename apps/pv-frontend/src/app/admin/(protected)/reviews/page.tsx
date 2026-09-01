import type { Metadata } from "next";
import Link from "next/link";
import { listReviewsForModeration } from "@pv/backend/services/reviews";
import { requirePermission } from "@/server/session";
import { ReviewDecision } from "./review-decision";

export const metadata: Metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

type Params = { searchParams: Promise<{ status?: string }> };

const STATUSES = ["pending", "approved", "rejected"] as const;

export default async function ReviewsAdminPage({ searchParams }: Params) {
  await requirePermission("review.moderate");

  const { status } = await searchParams;
  const filter = STATUSES.find((candidate) => candidate === status) ?? "pending";

  const reviews = await listReviewsForModeration({ status: filter });

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
                ? "border-(--pv-red) bg-(--pv-red) text-white"
                : "border-(--pv-line) bg-white"
            }`}
          >
            {candidate}
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-(--pv-line) bg-white p-6 text-sm text-(--pv-muted)">
          {filter === "pending" ? "Nothing is waiting to be checked." : `No ${filter} reviews.`}
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 lg:grid-cols-2">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-2xl border border-(--pv-line) bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{review.productName}</p>
                  <p className="text-sm text-(--pv-muted)">
                    {review.rating} out of 5 · {review.authorName}
                    {review.verifiedPurchase ? " · verified purchase" : ""}
                  </p>
                </div>
                <time
                  className="text-xs text-(--pv-muted)"
                  dateTime={review.submittedAt.toISOString()}
                >
                  {formatLagos(review.submittedAt)}
                </time>
              </div>

              {review.title ? <p className="mt-3 font-semibold">{review.title}</p> : null}
              <p className="mt-1 text-sm leading-6">{review.body}</p>

              <ReviewDecision reviewId={review.id} status={review.status} />
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
