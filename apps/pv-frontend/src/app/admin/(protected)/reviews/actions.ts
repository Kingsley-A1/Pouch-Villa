"use server";

import { revalidatePath } from "next/cache";
import { reviewModerationSchema } from "@pv/backend/domain/schemas";
import { approveReview, rejectReview, softDeleteReview } from "@pv/backend/services/reviews";
import { toActionError, type ActionState } from "@/lib/action-state";
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

  revalidatePath("/admin/reviews");
  return { error: null, message: "Published." };
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

  revalidatePath("/admin/reviews");
  return { error: null, message: "Rejected. It will not appear on the storefront." };
}

/** Nothing is hard-deleted — §6. This soft-deletes with an actor and a reason. */
export async function deleteReviewAction(reviewId: string, reason: string): Promise<void> {
  const principal = await requirePermission("review.moderate");
  await softDeleteReview(reviewId, reason, { staffId: principal.staffId });
  revalidatePath("/admin/reviews");
}
