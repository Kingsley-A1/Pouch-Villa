"use client";

import { useActionState, useState } from "react";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { FormError, FormSuccess, SubmitButton } from "@/components/admin/form-controls";
import { ProgressiveDisclosure } from "@/components/progressive-disclosure";
import { transitionOrderAction } from "../actions";

export type AvailableStep = {
  status: string;
  label: string;
  destructive: boolean;
};

/**
 * The steps this order can actually take, computed server-side from the
 * transition table and passed in. Rendering a button is never the authorisation
 * — the action re-derives both the legality of the move and the permission it
 * needs before touching anything (§0 rule 4).
 */
export function StatusControl({ orderId, steps }: { orderId: string; steps: AvailableStep[] }) {
  const [state, submit, pending] = useActionState(transitionOrderAction, INITIAL_ACTION_STATE);
  const [chosen, setChosen] = useState<AvailableStep | null>(null);

  if (steps.length === 0) {
    return <p className="text-sm text-(--pv-muted)">This order is complete. No further steps.</p>;
  }

  return (
    <form action={submit} className="grid gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="status" value={chosen?.status ?? ""} />

      <div className="flex flex-wrap gap-2">
        {steps.map((step) => (
          <button
            key={step.status}
            type="button"
            onClick={() => setChosen(step)}
            aria-pressed={chosen?.status === step.status}
            className={`inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-bold ${
              chosen?.status === step.status
                ? step.destructive
                  ? "border-(--pv-danger) bg-(--pv-danger) text-white"
                  : "border-(--pv-red) bg-(--pv-red) text-white"
                : "border-(--pv-line) bg-white"
            }`}
          >
            {step.label}
          </button>
        ))}
      </div>

      {/* A reason is only asked for where it will actually be recorded, and the
          field appears rather than sitting there greyed out. */}
      <ProgressiveDisclosure open={chosen?.destructive === true}>
        <div className="pt-1">
          <label className="label" htmlFor="cancel-reason">
            Why is this being cancelled?
          </label>
          <input
            id="cancel-reason"
            name="reason"
            className="field"
            maxLength={500}
            placeholder="Recorded on the order and in the audit log"
          />
        </div>
      </ProgressiveDisclosure>

      <ProgressiveDisclosure open={chosen !== null}>
        <div className="pt-1">
          <SubmitButton
            variant={chosen?.destructive ? "danger" : "primary"}
            pendingLabel="Updating…"
          >
            {chosen === null ? "Choose a step" : chosen.label}
          </SubmitButton>
          {chosen?.destructive ? (
            <p className="help mt-2">
              Cancelling returns the stock to the ledger and cannot be undone.
            </p>
          ) : null}
        </div>
      </ProgressiveDisclosure>

      <div aria-live="polite" className="grid gap-2">
        <FormError message={state.error} />
        {!pending ? <FormSuccess message={state.message} /> : null}
      </div>
    </form>
  );
}
