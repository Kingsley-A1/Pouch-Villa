"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { reviewModerationSchema } from "@pv/backend/domain/schemas";
import {
  approveReview,
  moderateReviews,
  rejectReview,
  softDeleteReview,
} from "@pv/backend/services/reviews";
import { sendReviewDecisionEmail } from "@pv/backend/services/review-email";
import { toActionError, type ActionState } from "@/lib/action-state";
import { dispatchEmail } from "@/server/notify";
import { requirePermission } from "@/server/session";

/**
 * Review moderation.
 *
 * Because anyone may submit a review (Q9, ADR 0005), this queue is the only
 * thing standing between a stranger's text and the storefront. Every decision
 * is permission-checked server-side and written to the audit trail.
 */

function parse(formData: FormData) {
  return reviewModerationSchema.safeParse({
    reviewId: formData.get("reviewId"),
    reason: formData.get("reason") || null,
  });
}

export async function approveReviewAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("review.moderate");
  const parsed = parse(formData);
  if (!parsed.success) return { error: "That review could not be approved." };

  try {
    await approveReview(parsed.data.reviewId, { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "That review could not be approved.");
  }

  dispatchEmail("Review decision", sendReviewDecisionEmail(parsed.data.reviewId, "approved"));

  revalidatePath("/admin/reviews");
  return { error: null, message: "Published, and the author has been told." };
}

export async function rejectReviewAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("review.moderate");
  const parsed = parse(formData);
  if (!parsed.success) return { error: "That review could not be rejected." };

  try {
    await rejectReview(parsed.data.reviewId, parsed.data.reason ?? "Not published", {
      staffId: principal.staffId,
    });
  } catch (error) {
    return toActionError(error, "That review could not be rejected.");
  }

  /**
   * The author is told it was not published, and deliberately not why: the
   * reason field is staff wording written for staff — "spam", "abusive" — and
   * forwarding it turns a quiet moderation decision into an argument.
   */
  dispatchEmail("Review decision", sendReviewDecisionEmail(parsed.data.reviewId, "rejected"));

  revalidatePath("/admin/reviews");
  return { error: null, message: "Rejected. It will not appear on the storefront." };
}

/** Nothing is hard-deleted — §6. This soft-deletes with an actor and a reason. */
export async function deleteReviewAction(reviewId: string, reason: string): Promise<void> {
  const principal = await requirePermission("review.moderate");
  await softDeleteReview(reviewId, reason, { staffId: principal.staffId });
  revalidatePath("/admin/reviews");
}

/**
 * Clearing a batch of the queue at once.
 *
 * A plain form action rather than a `useActionState` one, because the list it
 * sits under is server-rendered and holds no client state — the checkboxes are
 * the selection. Feedback comes back as a redirect parameter the page renders,
 * so the whole flow works with JavaScript unavailable.
 *
 * The service refuses anything no longer pending, so a stale checkbox from a
 * list a colleague has already worked through cannot silently re-decide a
 * review. Every review in the batch still gets its own audit record.
 */
export async function bulkModerateAction(formData: FormData): Promise<void> {
  const principal = await requirePermission("review.moderate");

  const reviewIds = formData
    .getAll("reviewIds")
    .filter((id): id is string => typeof id === "string");
  const decision = formData.get("decision");
  const status = typeof formData.get("status") === "string" ? formData.get("status") : "pending";

  const back = (note: string) =>
    `/admin/reviews?status=${encodeURIComponent(String(status))}&done=${encodeURIComponent(note)}`;

  if (reviewIds.length === 0) redirect(back("Choose at least one review first."));
  if (decision !== "approved" && decision !== "rejected") {
    redirect(back("That decision is not valid."));
  }

  const moderated = await moderateReviews(reviewIds, decision, { staffId: principal.staffId });
  // Only the reviews that really moved. A ticked box for one a colleague already
  // decided must not produce a second message about it.
  for (const reviewId of moderated) {
    dispatchEmail("Review decision", sendReviewDecisionEmail(reviewId, decision));
  }
  const count = moderated.length;
  revalidatePath("/admin/reviews");

  redirect(
    back(
      count === 0
        ? "Nothing changed — those were already decided."
        : `${count} ${count === 1 ? "review" : "reviews"} ${
            decision === "approved" ? "published" : "rejected"
          }.`,
    ),
  );
}
