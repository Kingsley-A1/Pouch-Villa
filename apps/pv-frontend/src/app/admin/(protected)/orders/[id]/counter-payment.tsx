"use client";

import { useActionState, useState } from "react";
import { Bank, CreditCard, Money } from "@phosphor-icons/react";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { FormError, FormSuccess, SubmitButton } from "@/components/admin/form-controls";
import { ProgressiveDisclosure } from "@/components/progressive-disclosure";
import { recordCounterPaymentAction } from "../actions";

const METHODS = [
  ["cash", "Cash", Money],
  ["pos_card", "POS", CreditCard],
  ["bank_transfer", "Transfer", Bank],
] as const;

/**
 * The counter. One screen, three buttons, one confirmation.
 *
 * This is used standing up, one-handed, with a customer waiting — so it is sized
 * for a thumb and asks for nothing it does not need. The customer's stated
 * preference pre-selects a button and is never enforced: somebody who said cash
 * and then produced a card must be recorded as having produced a card, or the
 * till will not balance.
 *
 * The note is optional and deliberately unlabelled as anything financial. It is
 * for a POS stub number or a transfer narration — never a card number, which §5
 * forbids reaching a log or an audit row, and which the shop has no reason to
 * hold.
 */
export function CounterPayment({
  orderId,
  amountLabel,
  preferred,
}: {
  orderId: string;
  amountLabel: string;
  preferred: "cash" | "pos_card" | "bank_transfer";
}) {
  const [state, submit, pending] = useActionState(recordCounterPaymentAction, INITIAL_ACTION_STATE);
  const [method, setMethod] = useState<string>(preferred);

  return (
    <form action={submit} className="grid gap-3">
      <input type="hidden" name="orderId" value={orderId} />

      <p className="text-sm">
        Taking <span className="font-extrabold tabular-nums">{amountLabel}</span>. What did they pay
        with?
      </p>

      <div className="grid grid-cols-3 gap-2">
        {METHODS.map(([value, label, Icon]) => (
          <label
            key={value}
            className={`flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center transition-colors ${
              method === value
                ? "border-(--pv-red) bg-(--pv-red) text-(--pv-on-brand)"
                : "border-(--pv-line) bg-(--pv-surface)"
            }`}
          >
            <input
              type="radio"
              name="method"
              value={value}
              checked={method === value}
              onChange={() => setMethod(value)}
              className="sr-only"
            />
            <Icon size={20} weight="bold" aria-hidden="true" />
            <span className="text-sm font-bold">{label}</span>
          </label>
        ))}
      </div>

      <div>
        <label className="label" htmlFor="counter-note">
          Reference (optional)
        </label>
        <input
          id="counter-note"
          name="note"
          className="field min-h-11"
          maxLength={500}
          placeholder="POS stub number, transfer narration"
        />
      </div>

      <SubmitButton pendingLabel="Recording…">Record payment</SubmitButton>

      {/*
        Said before the press, not after. Recording a payment confirms the order
        and emails the customer, and a staff member should know that is what the
        button does while they can still not press it.
      */}
      <ProgressiveDisclosure open={!pending}>
        <p className="help">This confirms the order and tells the customer their payment is in.</p>
      </ProgressiveDisclosure>

      <div aria-live="polite" className="grid gap-2">
        <FormError message={state.error} />
        {!pending ? <FormSuccess message={state.message} /> : null}
      </div>
    </form>
  );
}
