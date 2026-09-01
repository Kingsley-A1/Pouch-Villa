"use client";

import { useActionState } from "react";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { FormError, FormSuccess, SubmitButton } from "@/components/admin/form-controls";
import { deleteEnquiryAction, setEnquiryStatusAction } from "./actions";

export function EnquiryActions({
  id,
  status,
  staffNote,
}: {
  id: string;
  status: string;
  staffNote: string | null;
}) {
  const [state, submit] = useActionState(setEnquiryStatusAction, INITIAL_ACTION_STATE);

  const next = status === "new" ? "in_progress" : status === "in_progress" ? "closed" : "new";
  const nextLabel =
    next === "in_progress" ? "Start working on it" : next === "closed" ? "Close" : "Reopen";

  return (
    <div className="mt-4 grid gap-2">
      <form action={submit} className="grid gap-2">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value={next} />
        <label className="sr-only" htmlFor={`note-${id}`}>
          Internal note
        </label>
        <input
          id={`note-${id}`}
          name="note"
          className="field"
          maxLength={1000}
          defaultValue={staffNote ?? ""}
          placeholder="Internal note (optional)"
        />
        <SubmitButton variant={next === "closed" ? "primary" : "ghost"} pendingLabel="Saving…">
          {nextLabel}
        </SubmitButton>
      </form>

      <ConfirmButton
        label="Remove"
        confirmLabel="Remove this enquiry"
        onConfirm={() => deleteEnquiryAction(id)}
      />

      <div aria-live="polite" className="grid gap-2">
        <FormError message={state.error} />
        <FormSuccess message={state.message} />
      </div>
    </div>
  );
}
