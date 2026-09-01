"use client";

import { useActionState, useState } from "react";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { FormError, FormSuccess, SubmitButton } from "@/components/admin/form-controls";
import { ProgressiveDisclosure } from "@/components/progressive-disclosure";
import { approveReviewAction, deleteReviewAction, rejectReviewAction } from "./actions";

export function ReviewDecision({ reviewId, status }: { reviewId: string; status: string }) {
  const [approveState, approve] = useActionState(approveReviewAction, INITIAL_ACTION_STATE);
  const [rejectState, reject] = useActionState(rejectReviewAction, INITIAL_ACTION_STATE);
  const [rejecting, setRejecting] = useState(false);

  return (
    <div className="mt-4 grid gap-2">
      {status === "pending" ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <form action={approve}>
              <input type="hidden" name="reviewId" value={reviewId} />
              <SubmitButton pendingLabel="Publishing…">Publish</SubmitButton>
            </form>

            <button
              type="button"
              onClick={() => setRejecting((previous) => !previous)}
              aria-expanded={rejecting}
              className="min-h-11 px-2 text-sm font-bold text-(--pv-danger)"
            >
              {rejecting ? "Cancel" : "Reject"}
            </button>
          </div>

          <ProgressiveDisclosure open={rejecting}>
            <form action={reject} className="grid gap-2 pt-1">
              <input type="hidden" name="reviewId" value={reviewId} />
              <label className="label" htmlFor={`reject-${reviewId}`}>
                Reason (kept internally)
              </label>
              <input id={`reject-${reviewId}`} name="reason" className="field" maxLength={500} />
              <SubmitButton variant="danger" pendingLabel="Rejecting…">
                Reject review
              </SubmitButton>
            </form>
          </ProgressiveDisclosure>
        </>
      ) : (
        <p className="text-sm text-(--pv-muted)">
          {status === "approved" ? "Published on the storefront." : "Rejected."}
        </p>
      )}

      <ConfirmButton
        label="Remove"
        confirmLabel="Remove permanently from view"
        onConfirm={() => deleteReviewAction(reviewId, "Removed by staff")}
      />

      <div aria-live="polite" className="grid gap-2">
        <FormError message={approveState.error ?? rejectState.error} />
        <FormSuccess message={approveState.message ?? rejectState.message} />
      </div>
    </div>
  );
}
