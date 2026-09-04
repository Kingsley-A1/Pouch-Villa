"use client";

import { useActionState, useState } from "react";
import { DownloadSimple, Eye, X } from "@phosphor-icons/react";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { FormError, FormSuccess, SubmitButton } from "@/components/admin/form-controls";
import { ProgressiveDisclosure } from "@/components/progressive-disclosure";
import { acceptProofAction, rejectProofAction } from "./actions";

/**
 * Reviewing one transfer proof.
 *
 * The document opens **in place**, under the decision it informs. It used to
 * open in a new tab from a signed R2 URL, which cost the reviewer the queue they
 * were working through and put a bank statement into browser history where it
 * could be copied out and forwarded for the lifetime of the signature.
 *
 * It is still fetched only on demand — every read is audited (§8), so loading
 * one for every row on every render would fill the audit trail with reads nobody
 * performed and bury the real ones. Nothing points at the document until
 * somebody asks to see it.
 */
export function ProofReview({
  proofId,
  status,
  contentType,
}: {
  proofId: string;
  status: string;
  /** Decides whether the document renders as a picture or a framed PDF. */
  contentType: string;
}) {
  const [acceptState, accept] = useActionState(acceptProofAction, INITIAL_ACTION_STATE);
  const [rejectState, reject] = useActionState(rejectProofAction, INITIAL_ACTION_STATE);
  const [open, setOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const decided = status !== "pending";
  const documentUrl = `/api/v1/payments/proofs/${proofId}/document`;
  const isPdf = contentType === "application/pdf";

  return (
    <div className="grid gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`proof-${proofId}`}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-(--pv-line) bg-(--pv-surface) px-4 text-sm font-bold"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={17} weight="bold" /> : <Eye size={17} weight="bold" />}
        {open ? "Close receipt" : "View receipt"}
      </button>

      {/*
        Mounted only once opened, so the request that fetches the document — and
        the audit row it writes — happens when a person actually looks.
      */}
      {open ? (
        <div
          id={`proof-${proofId}`}
          className="overflow-hidden rounded-xl border border-(--pv-line) bg-(--pv-wash)"
        >
          {isPdf ? (
            <iframe
              src={documentUrl}
              title="Payment receipt"
              // Tall enough to read a transfer confirmation without scrolling
              // inside a frame inside a page, which on a phone is unusable.
              className="h-[28rem] w-full bg-white"
            />
          ) : (
            /*
              A plain <img>, not next/image: the optimiser would fetch and cache
              a financial document through its own pipeline, and every render
              must instead be an authorised, audited read of the original.
            */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={documentUrl}
              alt="The receipt uploaded for this payment"
              className="max-h-[28rem] w-full bg-white object-contain"
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-(--pv-line) p-2">
            <a
              href={`${documentUrl}?download=1`}
              download
              className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-bold text-(--pv-ink) hover:text-(--pv-red)"
            >
              <DownloadSimple size={16} weight="bold" />
              Download
            </a>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-(--pv-muted) hover:text-(--pv-ink)"
            >
              Close
            </button>
          </div>
        </div>
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
