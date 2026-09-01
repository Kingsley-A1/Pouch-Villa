"use client";

import { useActionState } from "react";
import { Minus, Plus, Trash } from "@phosphor-icons/react";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { removeLineAction, setQuantityAction } from "./actions";

/**
 * Client because a stepper is an interaction: it changes a value and submits
 * without a page navigation.
 *
 * It degrades to plain form posts. Each control is a real submit button carrying
 * its own value, so with JavaScript unavailable every one of them still works —
 * which on a mid-range Android on Nigerian mobile data is not a hypothetical.
 */
export function QuantityStepper({
  variantId,
  quantity,
  inStock,
  productName,
}: {
  variantId: string;
  quantity: number;
  inStock: number;
  productName: string;
}) {
  const [quantityState, submitQuantity, quantityPending] = useActionState(
    setQuantityAction,
    INITIAL_ACTION_STATE,
  );
  const [removeState, submitRemove, removePending] = useActionState(
    removeLineAction,
    INITIAL_ACTION_STATE,
  );

  const atStockLimit = quantity >= inStock;
  const error = quantityState.error ?? removeState.error;

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <form action={submitQuantity} className="contents">
          <input type="hidden" name="variantId" value={variantId} />
          <button
            type="submit"
            name="quantity"
            value={quantity - 1}
            className="button-ghost h-11 !min-h-11 w-11 !p-0"
            disabled={quantityPending || quantity <= 1}
            aria-label={`Reduce ${productName} quantity to ${quantity - 1}`}
          >
            <Minus size={16} weight="bold" />
          </button>
        </form>

        <output
          className="min-w-11 text-center text-sm font-bold tabular-nums"
          aria-live="polite"
          aria-label={`${productName} quantity`}
        >
          {quantity}
        </output>

        <form action={submitQuantity} className="contents">
          <input type="hidden" name="variantId" value={variantId} />
          <button
            type="submit"
            name="quantity"
            value={quantity + 1}
            className="button-ghost h-11 !min-h-11 w-11 !p-0"
            disabled={quantityPending || atStockLimit}
            aria-label={`Increase ${productName} quantity to ${quantity + 1}`}
          >
            <Plus size={16} weight="bold" />
          </button>
        </form>

        <form action={submitRemove} className="contents">
          <input type="hidden" name="variantId" value={variantId} />
          <button
            type="submit"
            className="button-ghost ml-1 h-11 !min-h-11 w-11 !p-0 text-(--pv-danger)"
            disabled={removePending}
            aria-label={`Remove ${productName} from your cart`}
          >
            <Trash size={16} weight="bold" />
          </button>
        </form>
      </div>

      {/*
        Stock is stated in words as well as by disabling the button, because
        colour and a disabled state alone do not carry meaning (WCAG 2.2 AA).
      */}
      {atStockLimit ? (
        <p className="mt-1.5 text-xs text-(--pv-muted)">
          {inStock === 0
            ? "Out of stock"
            : `Only ${inStock} left, so this is the most you can order.`}
        </p>
      ) : null}

      {error ? (
        <p className="mt-1.5 text-xs text-(--pv-danger)" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
