"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, ShoppingBag } from "@phosphor-icons/react";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { addToCartAction } from "@/app/(store)/cart/actions";

/**
 * Client because choosing a variant is local state that must not cost a round
 * trip on a slow connection — the whole point of picking a colour is that it
 * responds instantly.
 *
 * Prices come from the server as already-formatted strings so this component
 * never touches money arithmetic, and no `Kobo` value has to survive the
 * client boundary as a bare number that could be mistaken for naira.
 */
export type SelectableVariant = {
  id: string;
  label: string;
  priceLabel: string;
  inStock: number;
};

export function AddToCart({
  variants,
  productName,
}: {
  variants: SelectableVariant[];
  productName: string;
}) {
  const firstAvailable = variants.find((variant) => variant.inStock > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState(firstAvailable?.id ?? "");
  const [state, submit, pending] = useActionState(addToCartAction, INITIAL_ACTION_STATE);

  const selected = variants.find((variant) => variant.id === selectedId);
  const soldOut = selected !== undefined && selected.inStock <= 0;

  if (variants.length === 0) {
    return (
      <p className="mt-4 text-sm text-(--pv-muted)">
        This product has no options configured yet, so it cannot be ordered.
      </p>
    );
  }

  return (
    <form action={submit} className="mt-6">
      <input type="hidden" name="variantId" value={selectedId} />

      {/*
        A radiogroup rather than a <select>: the options are few, the price and
        stock of each matters to the choice, and a native select cannot show
        them. Radios keep full keyboard semantics without any ARIA of our own.
      */}
      {variants.length > 1 ? (
        <fieldset>
          <legend className="label">Choose an option</legend>
          <div className="mt-1 grid gap-2">
            {variants.map((variant) => {
              const unavailable = variant.inStock <= 0;
              return (
                <label
                  key={variant.id}
                  className={`flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-2.5 transition-colors ${
                    variant.id === selectedId
                      ? "border-(--pv-red) bg-(--pv-cream)"
                      : "border-(--pv-line) hover:border-(--pv-muted)"
                  } ${unavailable ? "opacity-60" : ""}`}
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="variantChoice"
                      value={variant.id}
                      checked={variant.id === selectedId}
                      onChange={() => setSelectedId(variant.id)}
                      className="h-4 w-4 accent-(--pv-red)"
                    />
                    <span className="text-sm font-semibold">{variant.label}</span>
                  </span>
                  <span className="text-sm tabular-nums">
                    {variant.priceLabel}
                    {unavailable ? (
                      <span className="ml-2 text-(--pv-muted)">Out of stock</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="button-primary flex-1 sm:flex-none"
          disabled={pending || soldOut || selectedId === ""}
        >
          <ShoppingBag size={18} weight="bold" />
          {soldOut ? "Out of stock" : pending ? "Adding…" : "Add to cart"}
        </button>

        {state.message ? (
          <Link href="/cart" className="button-ghost">
            <Check size={18} weight="bold" /> View cart
          </Link>
        ) : null}
      </div>

      <p aria-live="polite" className="mt-2 text-sm">
        {state.error ? (
          <span className="text-(--pv-danger)">{state.error}</span>
        ) : state.message ? (
          <span className="text-(--pv-success)">{productName} was added to your cart.</span>
        ) : null}
      </p>
    </form>
  );
}
