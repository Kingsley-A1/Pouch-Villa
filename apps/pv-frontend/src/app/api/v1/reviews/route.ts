import { reviewSubmissionSchema } from "@pv/backend/domain/schemas";
import { submitReview } from "@pv/backend/services/reviews";
import { created, parseJson, requestContext, toApiError } from "@/server/api";
import { getCustomerPrincipal } from "@/server/customer-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Review submission — open to anyone, per the client's Q9 answer and ADR 0005.
 *
 * There is no authentication check here and that is deliberate, not an omission.
 * A session is read only so that a signed-in reviewer's review can be linked to
 * their account; its absence changes nothing about whether the review is
 * accepted.
 *
 * What keeps this safe is that **nothing published here reaches the storefront
 * unread**: every review is held for approval, so the worst a spammer achieves
 * is one entry in a moderation queue. Rate limiting keeps the queue itself from
 * being flooded.
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, reviewSubmissionSchema);
  if (!parsed.ok) return parsed.response;

  const customer = await getCustomerPrincipal();
  const context = await requestContext();

  try {
    const submitted = await submitReview(
      {
        ...parsed.data,
        // A signed-in reviewer's own address is more trustworthy than a typed
        // one for matching a purchase, so it wins where both are present.
        authorEmail: customer?.email ?? parsed.data.authorEmail,
        authorPhone: customer?.phone ?? null,
        customerId: customer?.customerId ?? null,
      },
      { ip: context.ip, requestId: context.requestId },
    );

    return created({
      reviewId: submitted.reviewId,
      status: "pending",
      message: "Thank you. Your review will appear once it has been checked.",
    });
  } catch (error) {
    return toApiError(error);
  }
}
