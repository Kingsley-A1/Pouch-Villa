"use client";

import { useActionState, useState, useTransition } from "react";
import { Eye } from "@phosphor-icons/react";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { FormError, FormSuccess, SubmitButton } from "@/components/admin/form-controls";
import { ProgressiveDisclosure } from "@/components/progressive-disclosure";
import { acceptProofAction, rejectProofAction, viewProofAction } from "./actions";

/**
 * Reviewing one transfer proof.
 *
 * The document is fetched **on demand**, not with the page: every signed URL is
 * an audited access, so minting one for every row on every render would fill the
 * audit trail with reads nobody performed and make the real ones impossible to
 * find (§8).
 *
 * The URL that comes back is held in local state and opened in a new tab. It is
 * never written to the DOM as a link the browser might prefetch, never logged,
 * and expires in minutes.
 */
export function ProofReview({ proofId, status }: { proofId: string; status: string }) {
  const [acceptState, accept] = useActionState(acceptProofAction, INITIAL_ACTION_STATE);
  const [rejectState, reject] = useActionState(rejectProofAction, INITIAL_ACTION_STATE);
  const [viewing, startViewing] = useTransition();
  const [viewError, setViewError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  const decided = status !== "pending";

  return (
    <div className="grid gap-3">
      <button
        type="button"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-(--pv-line) bg-(--pv-surface) px-4 text-sm font-bold"
        disabled={viewing}
        onClick={() =>
          startViewing(async () => {
            setViewError(null);
            const result = await viewProofAction(proofId);
            if ("error" in result) {
              setViewError(result.error);
              return;
            }
            window.open(result.url, "_blank", "noopener,noreferrer");
          })
        }
      >
        <Eye size={17} weight="bold" />
        {viewing ? "Opening…" : "View receipt"}
      </button>
      {viewError ? (
        <p className="text-sm text-(--pv-danger)" role="alert">
          {viewError}
        </p>
      ) : null}

      {decided ? (
        <p className="text-sm text-(--pv-muted)">Already {status}. No further action needed.</p>
      ) : (
        <>
          <form action={accept} className="grid gap-2">
            <input type="hidden" name="proofId" value={proofId} />
            <label className="sr-only" htmlFor={`note-${proofId}`}>
              What you saw on the statement
            </label>
            <input
              id={`note-${proofId}`}
              name="note"
              className="field"
              maxLength={500}
              placeholder="Narration on the statement (optional)"
            />
            <SubmitButton pendingLabel="Confirming…">Confirm payment</SubmitButton>
          </form>

          <button
            type="button"
            onClick={() => setRejecting((previous) => !previous)}
            aria-expanded={rejecting}
            className="min-h-11 text-sm font-bold text-(--pv-danger)"
          >
            {rejecting ? "Cancel" : "Cannot accept this"}
          </button>

          {/* A reason is required, because it is what the buyer is shown so they
              can upload something better. */}
          <ProgressiveDisclosure open={rejecting}>
            <form action={reject} className="grid gap-2 pt-1">
              <input type="hidden" name="proofId" value={proofId} />
              <label className="label" htmlFor={`reason-${proofId}`}>
                Why? The buyer will see this.
              </label>
              <input
                id={`reason-${proofId}`}
                name="reason"
                className="field"
                required={rejecting}
                maxLength={500}
              />
              <SubmitButton variant="danger" pendingLabel="Sending back…">
                Return to buyer
              </SubmitButton>
            </form>
          </ProgressiveDisclosure>
        </>
      )}

      <div aria-live="polite" className="grid gap-2">
        <FormError message={acceptState.error ?? rejectState.error} />
        <FormSuccess message={acceptState.message ?? rejectState.message} />
      </div>
    </div>
  );
}
