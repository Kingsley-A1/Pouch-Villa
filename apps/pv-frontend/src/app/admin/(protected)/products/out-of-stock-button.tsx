"use client";

import { useActionState, useState } from "react";
import { Prohibit } from "@phosphor-icons/react";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { ProgressiveDisclosure } from "@/components/progressive-disclosure";
import { markOutOfStockAction } from "./actions";

/**
 * "Out of stock" from the product list, with the confirmation inline.
 *
 * Two presses rather than one, because this empties every variant at once and a
 * mis-tap on a phone is easy. The confirmation opens in place instead of in a
 * dialog: a modal on a 360 px screen covers the row that says which product is
 * about to be emptied, which is the one thing the person needs to read.
 *
 * Nothing is destroyed — the ledger keeps its history and staff put stock back by
 * adding it — so the button is not styled as a destructive action. The
 * confirmation says what it will do rather than warning about it.
 */
export function OutOfStockButton({
  productId,
  productName,
  inStock,
}: {
  productId: string;
  productName: string;
  inStock: number;
}) {
  const [state, submit, pending] = useActionState(markOutOfStockAction, INITIAL_ACTION_STATE);
  const [confirming, setConfirming] = useState(false);

  // Nothing to zero. Saying so beats a button that reports an error when pressed.
  if (inStock <= 0) {
    return (
      <span className="inline-flex min-h-11 items-center px-1 text-xs text-(--pv-muted)">
        Out of stock
      </span>
    );
  }

  if (state.message !== undefined && !pending) {
    return (
      <span className="inline-flex min-h-11 items-center px-1 text-xs font-semibold" role="status">
        {state.message}
      </span>
    );
  }

  return (
    <div className="flex-1 sm:flex-none">
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-(--pv-line) px-4 text-sm font-bold text-(--pv-ink) hover:border-(--pv-red) hover:text-(--pv-red) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red) sm:w-auto"
        >
          <Prohibit aria-hidden="true" size={16} weight="bold" />
          Out of stock
          {/* The name is only in the accessible name: the visible label has to
              stay short enough to sit beside two others at 360 px. */}
          <span className="sr-only"> — mark {productName} out of stock</span>
        </button>
      ) : (
        <form action={submit} className="grid gap-2">
          <input type="hidden" name="productId" value={productId} />
          <p className="text-xs text-(--pv-muted)">
            Set all {inStock} in stock to zero? You can add stock back afterwards.
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-(--pv-red) px-4 text-sm font-bold text-(--pv-on-brand) disabled:opacity-60"
            >
              {pending ? "Setting…" : "Yes, zero it"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-(--pv-line) px-4 text-sm font-bold"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <ProgressiveDisclosure open={state.error !== null}>
        <p className="pt-1 text-xs text-(--pv-danger)" role="alert">
          {state.error}
        </p>
      </ProgressiveDisclosure>
    </div>
  );
}
